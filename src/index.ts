import { RestApiWrapper } from "./restApiWrapper";
import { IConfig } from "./types/Config";
import polly from "polly-js";
import chalk from 'chalk';
import * as DWRest from "./types/DW_Rest";
import * as fs from 'fs';
import yargs from 'yargs'

const argv = yargs(process.argv.slice(2))
  .option("config", {
    alias: "c",
    default: "./config.json",
    describe: "Config file path"
  }).parseSync();

const config: IConfig = JSON.parse(fs.readFileSync(argv.config, 'utf8'));

// Docuware REST API Wrapper
const restApi: RestApiWrapper = new RestApiWrapper(config.rootUrl, 443);
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
      const documentIds: number[] = [];

      console.log(chalk.whiteBright("\t> Document Tray:"), chalk.white(`${documentTray.Name} (Id: ${documentTray.Id})`));
      console.log(chalk.whiteBright("\t> File Cabinet:"), chalk.white(`${fileCabinet.Name} (Id: ${fileCabinet.Id})`));

      if(task.intellixTrust && task.intellixTrust.length > 0) {
        console.log(chalk.whiteBright("\t> Intellix Trust Filter:"), chalk.white(task.intellixTrust.join(',')));
      }

      if(task.documentTitleMask) {
        console.log(chalk.whiteBright("\t> Document Title Mask:"), chalk.white(task.documentTitleMask));
      }

      documentsFromTray.Items.forEach(doc => {
        if (
          isIntellixTrustAllowed(doc, task.intellixTrust ?? [])
          && isDocumentTitleMaskAllowed(doc, task.documentTitleMask ?? '')
          && doc.Id) {
          documentIds.push(doc.Id)
        }
      });

      const documentsQueryResult = await transferDocumentsFromDocumentTrayToFileCabinet(
        documentTray,
        fileCabinet,
        documentIds,
        task.keepSource
      );

      const processedCount = JSON.parse(JSON.stringify(documentsQueryResult.Count));
      console.log(chalk.green(`\t> Stored ${chalk.green(processedCount.Value)} documents`));
      });
  })
  .catch((error: Error) => {
    traceError(error);
  });

/**
 * Do documents match allowed intellix trusts (intelligent indexing scores)?
 * 
 * If intellix trust matches then allow
 * If no intellix trusts are defined via configuration allow all by default
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
function isIntellixTrustAllowed(document: DWRest.IDocument, intellixTrust: string[]) {
  return (intellixTrust.includes(document.IntellixTrust ? document.IntellixTrust : '')
    || intellixTrust.length === 0)
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
  keepSource:boolean
) {
  const documentsQueryResult: DWRest.IDocumentsQueryResult =
    await restApi.TransferFromDocumentTrayToFileCabinet(
      docIdsToTransfer,
      documentTray.Id,
      fileCabinet,
      keepSource
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
