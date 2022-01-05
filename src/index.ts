import * as DWRest from "./types/DW_Rest";
import * as fs from 'fs';
import * as micromatch from 'micromatch';
import polly from "polly-js";
import chalk from 'chalk';
import yargs, { option } from 'yargs'
import { RestApiWrapper } from "./restApiWrapper";
import { IConfig, IAutoStoreConfig, IAutoStoreConfigFilter } from "./types/Config";

const DEFAULT_STORE_LIMIT = 100;
const INTELLIX_TRUST_NAME = "IntellixTrust";

const args = yargs(process.argv.slice(2))
  .option("config", {
    alias: "c",
    default: "./config.json",
    describe: "Config file path"
  })
  .boolean("dry-run")
  .alias("d", "dry-run")
  .default("dry-run", false)
  .parse();

const config:IConfig = loadConfiguration(args.config);  
const restApi: RestApiWrapper = new RestApiWrapper(config.rootUrl, 443, 120000);
const logonModel: DWRest.ILogonModel = restApi.CreateLogonModel(
  config.user,
  config.password,
  config.organization,
  config.hostID
);

console.log(chalk.bgWhite(chalk.black("Docuware Autostore\n")));

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
      console.log(chalk.whiteBright("\t> Intellix Trust Filter:"), chalk.white(getAllowedIntellixTrust(config)?.toString()));

      const documents = await getDocuments(documentTray, config);

      if(args['dry-run']) {
        documents.forEach(async doc => {
          console.log(`\t> ID:${doc.Id} Title:${doc.Title} IntellixTrust:${doc.IntellixTrust}`);

          if(config.fields) {
            console.log(await restApi.GetSuggestionFields(documents[0]));
          }

        })
      }else{
        await transferDocuments(
          documentTray,
          fileCabinet,
          documents,
          config
        );
      }

      console.log(chalk.green(`\t> Stored ${chalk.green(documents.length)} documents\n`));
    });
  })
  .catch((error: Error) => {
    traceError(error);
  });

/**
 * Load Configuration
 * 
 * @param {string} filepath 
 * @returns 
 */
function loadConfiguration(filepath: string) {
  let config:IConfig = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  return config;
}  

/**
 * Transfer document from tray to file cabinet
 * 
 * @param {DWRest.IFileCabinet} documentTray 
 * @param {DWRest.IFileCabinet} fileCabinet 
 * @param {number[]} docIdsToTransfer 
 * @returns {DWRest.DocumentsTransferResult}
 */
async function transferDocuments(
  documentTray: DWRest.IFileCabinet,
  fileCabinet: DWRest.IFileCabinet,
  documents: DWRest.IDocument[],
  config: IAutoStoreConfig
) {

  if(config.fields) {
    console.log(restApi.GetSuggestionFields(documents[0]));
  }

  const documentsQueryResult: DWRest.IDocumentsQueryResult =
    await restApi.TransferFromDocumentTrayToFileCabinet(
      documents.map(doc => doc.Id ?? 0),
      documentTray.Id,
      fileCabinet,
      config.keepSource,
      config.storeDialogID
    );

  return documentsQueryResult
}

/**
 * Get documents from tray
 * Returns array of first x documents in tray filtered by allowed values
 * 
 * @param {DWRest.IFileCabinet} documentTray 
 * @param {IAutoStoreConfig} config 
 * @returns {DWRest.IDocument[]}
 */
async function getDocuments(
  documentTray: DWRest.IFileCabinet,
  config: IAutoStoreConfig
) {
  const documentsFromTray = await restApi.GetDocumentQueryResultForSpecifiedCountFromFileCabinet(documentTray, config.limit ?? DEFAULT_STORE_LIMIT);
  return documentsFromTray.Items.filter(doc => 
    isDocumentFilterMatch(doc, config.filters ?? [])
  );
}

/**
* Get allowed intellix trusts from filter configuration
* 
* @param {IAutoStoreConfig} config
*/ 
function getAllowedIntellixTrust(config:IAutoStoreConfig)  {
  let filter = config?.filters?.find(o => o['name'] === INTELLIX_TRUST_NAME);
  return filter?.pattern;
}

/**
* Document filter match?
* Returns true if any of the given filter glob patterns match the specified document property string.
* @see https://github.com/micromatch/micromatch
* 
* @param {DWRest.IDocument} document 
* @param {IAutoStoreConfigFilter[]} filters
* @returns {boolean}
*/
function isDocumentFilterMatch(document: DWRest.IDocument, filters: IAutoStoreConfigFilter[]) {
  return filters.every((filter:IAutoStoreConfigFilter) => {
    return micromatch.isMatch(getDocumentProperty(filter.name, document), filter.pattern, filter.options);
  });
}

/**
 * Get source document property using dot notation
 * 
 * @param property 
 * @param obj 
 * @returns 
 */
function getDocumentProperty(property:string, obj:DWRest.IDocument) {
  return property.split('.').reduce((obj:any, i) => {
    return obj[i];
}, obj);
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