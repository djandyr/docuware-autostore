import { RestApiWrapper } from "./restApiWrapper";
import { IConfig, IAutoStoreConfig } from "./types/Config";
import polly from "polly-js";
import chalk from 'chalk';
import * as DWRest from "./types/DW_Rest";
import * as fs from 'fs';
import yargs from 'yargs'
import { Console } from "console";

const argv = yargs(process.argv.slice(2))
  .option("config", {
    alias: "c",
    default: "./config.json",
    describe: "Config file path"
  }).parseSync();

const config: IConfig = JSON.parse(fs.readFileSync(argv.config, 'utf8'));
const defaultIntellixTrusts:string[] = ["Green"]; // Only allow "Green" intellix trust if not configured

// Docuware REST API Wrapper
const restApi: RestApiWrapper = new RestApiWrapper(config.rootUrl, 443, 120000);
const logonModel: DWRest.ILogonModel = restApi.CreateLogonModel(
  config.user,
  config.password,
  config.organization,
  config.hostID
);

console.log(
  chalk.bgWhite(
    chalk.black("Docuware Autostore\n"),
  )
);

polly()
  .waitAndRetry(3)
  .executeForPromise(async () => {
    const logonResponse: DWRest.ILogonResponse = await restApi.Logon(logonModel);
    const organization: DWRest.IOrganization = await restApi.GetOrganization();
    console.log(chalk.whiteBright("Username:"), chalk.white(logonModel.Username));
    console.log(chalk.whiteBright("Organization:"), chalk.white(organization.Name));

    config.autoStore.forEach(async (task, index) => {
      console.log(
        chalk.yellow(
          `\nTask ${index+1}:`,
        )
      );

      const fileCabinet: DWRest.IFileCabinet = await restApi.GetFileCabinet(task.fileCabinetID);
      const documentTray: DWRest.IFileCabinet = await restApi.GetFileCabinet(task.documentTrayID);
      const documentsFromTray = await restApi.GetDocumentQueryResultForSpecifiedCountFromFileCabinet(documentTray, task.limit);

      console.log(chalk.whiteBright("\t> Document Tray:"), chalk.white(`${documentTray.Name} (Id: ${documentTray.Id})`));
      console.log(chalk.whiteBright("\t> File Cabinet:"), chalk.white(`${fileCabinet.Name} (Id: ${fileCabinet.Id})`));
      console.log(chalk.whiteBright("\t> Intellix Trust Filter:"), chalk.white(getAllowedIntellixTrustFromConfig(task).join(',')));

      if(task.documentTitleMask) {
        console.log(chalk.whiteBright("\t> Document Title Mask:"), chalk.white(task.documentTitleMask));
      }

      const documentIds: number[] = [];
      documentsFromTray.Items.forEach(doc => {
        if (
          isDocumentIntellixTrustAllowed(doc, getAllowedIntellixTrustFromConfig(task)) &&
          isDocumentTitleMaskAllowed(doc, task.documentTitleMask ?? '') &&
          doc.Id) {
          documentIds.push(doc.Id)
        }
      });

      await transferDocumentsFromDocumentTrayToFileCabinet(
        documentTray,
        fileCabinet,
        documentIds,
        task.keepSource,
        task.storeDialogId
      );

      console.log(chalk.green(`\t> Stored ${chalk.green(documentIds.length)} documents\n`));
      });
  })
  .catch((error: Error) => {
    traceError(error);
  });

/**
 * Get allowed intellix trusts from configuration
 * 
 * @param config
 * @returns 
 */ 
function getAllowedIntellixTrustFromConfig(config:IAutoStoreConfig)  {
    if(!config.intellixTrust) {
      return defaultIntellixTrusts;
    }

    return config.intellixTrust;
}

/**
 * Is documents intellix trust allowed to be stored?
 * 
 * Failed	    - Intelix failed
 * Green      - Recognized
 * InProgress	- Intelix still in progress
 * None	      - No intelix
 * Red	      - Unrecognized
 * Yellow	    - Predicted
 * 
 * @param document
 * @param config 
 * @returns 
 */
function isDocumentIntellixTrustAllowed(document: DWRest.IDocument, intellixTrust: string[]) {
  return intellixTrust.includes(document.IntellixTrust ? document.IntellixTrust : '')
}

/**
 * Do documents match filename mask?
 * 
 * @param document 
 * @param mask Regex Expression Pattern
 * @returns 
 */
function isDocumentTitleMaskAllowed(document: DWRest.IDocument, mask: string) {
  if(document.Title && mask !== '') {
    let re = new RegExp(mask);
    return re.test(document.Title);
  }
  return true;
}

/**
 * Transfer document from tray to file cabinet
 * 
 * @param documentTray 
 * @param fileCabinet 
 * @param docIdsToTransfer 
 * @returns 
 */
async function transferDocumentsFromDocumentTrayToFileCabinet(
  documentTray: DWRest.IFileCabinet,
  fileCabinet: DWRest.IFileCabinet,
  docIdsToTransfer: number[],
  keepSource:boolean,
  storeDialogId?: string
) {
  const documentsQueryResult: DWRest.IDocumentsQueryResult =
    await restApi.TransferFromDocumentTrayToFileCabinet(
      docIdsToTransfer,
      documentTray.Id,
      fileCabinet,
      keepSource,
      storeDialogId
    );

  return documentsQueryResult
}

/**
 * Traces error
 *
 * @param {Error} error
 */
function traceError(error: Error) {
  console.error(
    "Error message:\n\r" + error.message + "\n\rError Stack:\n\r" + error.stack
  );
}
