import { RestApiWrapper } from "./restApiWrapper";
import { IConfig, IAutoStoreConfig, IAutoStoreConfigFilter } from "./types/Config";
import polly from "polly-js";
import chalk from 'chalk';
import * as DWRest from "./types/DW_Rest";
import * as fs from 'fs';
import yargs from 'yargs'
import * as micromatch from 'micromatch';

const argv = yargs(process.argv.slice(2))
  .option("config", {
    alias: "c",
    default: "./config.json",
    describe: "Config file path"
  }).parse();

const config: IConfig = JSON.parse(fs.readFileSync(argv.config, 'utf8'));
const configDefaults = {
  intellixTrusts: ["Green"],
  limit: 50
}

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

    config.autoStore.forEach(async (config, index) => {
      const fileCabinet: DWRest.IFileCabinet = await restApi.GetFileCabinet(config.fileCabinetID);
      const documentTray: DWRest.IFileCabinet = await restApi.GetFileCabinet(config.documentTrayID);

      console.log(chalk.yellow(`\nTask ${index+1}:`));
      console.log(chalk.whiteBright("\t> Document Tray:"), chalk.white(`${documentTray.Name} (Id: ${documentTray.Id})`));
      console.log(chalk.whiteBright("\t> File Cabinet:"), chalk.white(`${fileCabinet.Name} (Id: ${fileCabinet.Id})`));
      console.log(chalk.whiteBright("\t> Intellix Trust Filter:"), chalk.white(getAllowedIntellixTrust(config).join(',')));

      const documents = await getDocuments(documentTray, config);
      await transferDocuments(
        documentTray,
        fileCabinet,
        documents.map(doc => doc.Id ?? 0),
        config.keepSource,
        config.storeDialogID
      );

      console.log(chalk.green(`\t> Stored ${chalk.green(documents.length)} documents\n`));
      });
  })
  .catch((error: Error) => {
    traceError(error);
  });

/**
 * Transfer document from tray to file cabinet
 * 
 * @param documentTray 
 * @param fileCabinet 
 * @param docIdsToTransfer 
 * @returns 
 */
async function transferDocuments(
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
 * Get documents from tray
 * 
 * Filter documents by allowed intellix trusts, and document filters
 * Limit x documents from tray
 * 
 * @param documentTray 
 * @param limit 
 * @returns 
 */
async function getDocuments(
  documentTray: DWRest.IFileCabinet,
  config: IAutoStoreConfig
) {
  const documentsFromTray = await restApi.GetDocumentQueryResultForSpecifiedCountFromFileCabinet(documentTray, config.limit ?? configDefaults.limit);
  return documentsFromTray.Items.filter(doc => 
    getAllowedIntellixTrust(config) && 
    isDocumentFilterMatch(doc, config.documentFilter ?? [])
  );
}

/**
 * Get allowed intellix trusts from configuration
 * 
 * @param config
 * @returns 
 */ 
 function getAllowedIntellixTrust(config:IAutoStoreConfig)  {
  return config.intellixTrust ?? configDefaults.intellixTrusts;
}

/**
* Is document intellix trust allowed to be stored?
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
* Document filter match?
* 
* Returns true if any of the given filter glob patterns match the specified document property string.
* @see https://github.com/micromatch/micromatch
* 
* @param document 
* @param filters
*/
function isDocumentFilterMatch(document: DWRest.IDocument, filters: IAutoStoreConfigFilter[]) {
const filterGuard = (filter:IAutoStoreConfigFilter) => {
  if(filter.name === 'title') {
    return micromatch.isMatch(document.Title ?? '', filter.pattern, filter.options);
  }
}
return filters.every(filterGuard);
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