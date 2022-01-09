#!/usr/bin/env node

import * as DWRest from "./types/DW_Rest";
import * as fs from "fs";
import * as micromatch from "micromatch";
import polly from "polly-js";
import chalk from "chalk";
import yargs, { option } from "yargs"
import { RestApiWrapper } from "./restApiWrapper";
import { IConfig, IAutoStoreConfig, IAutoStoreConfigFilter } from "./types/Config";
import expr from "property-expr";

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

const config: IConfig = loadConfiguration(args.config);
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

      console.log(chalk.yellow(`\nTask ${index + 1}:`));
      console.log(chalk.whiteBright("\t> Document Tray:"), chalk.white(`${documentTray.Name} (Id: ${documentTray.Id})`));
      console.log(chalk.whiteBright("\t> File Cabinet:"), chalk.white(`${fileCabinet.Name} (Id: ${fileCabinet.Id})`));

      if (getAllowedIntellixTrust(config)) {
        console.log(chalk.whiteBright("\t> Intellix Trust Filter:"), chalk.white(getAllowedIntellixTrust(config)?.toString()));
      }

      let docIdsToTransfer: number[] = [];
      for await (const document of getDocuments(documentTray, config)) {
        if (args['dry-run']) {
          console.log(`\t> ID:${document.Id} Title:${document.Title} IntellixTrust:${document.IntellixTrust}`);
          if (config.suggestions) {
            let suggestions = await getSuggestionFields(document, config);
            for (const field of suggestions) {
              console.log(`\t\t> ${field.Name.padEnd(25)} = ${('' + field.Value?.shift()?.Item).padEnd(50)} Confidence: ${field.Confidence}`);
            };
          }
          continue; // Do not transfer documents in dry-run
        }

        if(document.Id) {
          config.suggestions && await updateDocumentIndexValues(document, 
            await getSuggestionFields(document, config)
          )
          docIdsToTransfer.push(document.Id)
        }
      }

      await transferDocument(
        documentTray,
        fileCabinet,
        docIdsToTransfer,
        config
      );

      console.log(chalk.green(`\t> Stored ${chalk.green(docIdsToTransfer.length)} documents\n`));
    });
  })
  .catch((error: Error) => {
    traceError(error);
  });

/**
 * Load Configuration
 * 
 * @param {string} filepath 
 * @returns {object}
 */
function loadConfiguration(filepath: string) {
  let config: IConfig = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  return config;
}

/**
 * Update document index values
 * 
 * @param {DWRest.IDocument} document 
 * @param {DWRest.IDocumentSuggestion[]} suggestions
 * @returns {Promise<DWRest.IFieldList>}
 */
async function updateDocumentIndexValues(
  document: DWRest.IDocument,
  suggestions: DWRest.IDocumentSuggestion[]) {
  let fieldsToUpdate: DWRest.IFieldList = { Field: [] }
  for (const field of suggestions) {
    fieldsToUpdate.Field.push({
      'fieldName': field.Name,
      'item': field.Value[0].Item,
      'itemElementName': field.Value[0].ItemElementName
    })
  }

  return await restApi.UpdateDocumentIndexValues(document, fieldsToUpdate);
}

/**
 * Transfer document from tray to file cabinet
 * 
 * @param {DWRest.IFileCabinet} documentTray 
 * @param {DWRest.IFileCabinet} fileCabinet 
 * @param {DWRest.IDocument} document
 * @returns {Promise<DWRest.DocumentsTransferResult>}
 */
async function transferDocument(
  documentTray: DWRest.IFileCabinet,
  fileCabinet: DWRest.IFileCabinet,
  docIdsToTransfer: number[],
  config: IAutoStoreConfig
) {
  return await restApi.TransferFromDocumentTrayToFileCabinet(
    docIdsToTransfer,
    documentTray.Id,
    fileCabinet,
    config.keepSource,
    config.storeDialogID,
    config.suggestions ? false : true // FillIntellix
  );
}

/**
 * Returns documents in tray matching defined filter rules
 * 
 * @param {DWRest.IFileCabinet} documentTray 
 * @param {IAutoStoreConfig} config 
 * @returns {DWRest.IDocument[]}
 */
async function* getDocuments(documentTray: DWRest.IFileCabinet, config: IAutoStoreConfig) {
  const pager = await pageThroughDocumentTray(documentTray, config);

  for await (const documents of pager) {
    const filteredDocuments = documents.Items.filter(doc =>
      isFilterMatch(config.filters, doc)
    );

    for (let document of filteredDocuments) {
      yield document;
    }
  }
}

/**
 * Recursive async generator to yield each document page until out of pages
 * 
 * @param {DWRest.IFileCabinet} documentTray 
 * @param {IAutoStoreConfig} config 
 * @returns {DWRest.IDocument[]}
 */
async function* pageThroughDocumentTray(documentTray: DWRest.IFileCabinet, config: IAutoStoreConfig) {
  const documents = await restApi.GetDocumentQueryResultForSpecifiedCountFromFileCabinet(documentTray, config.limit ?? DEFAULT_STORE_LIMIT);
  yield documents;

  async function* requestNextResult(documents: DWRest.IDocumentsQueryResult): AsyncGenerator<DWRest.IDocumentsQueryResult> {
    if (documents.Next) {
      const next = await restApi.GetNextResultFromDocumentQueryResult(documents);
      yield* requestNextResult(documents);
    }
  }

  yield* requestNextResult(documents);
}

/**
 * Returns intellix field suggestions for a document by the Intelligent Indexing Service
 * 
 * Only use field suggestions matching their coresponding filter rule
 * If keepPreFilledIndexes:true field suggestion will be not be overridden if index already has a pre-filled value
 * 
 * @param document 
 * @param config 
 * @returns {Promise<DWRest.IDocumentSuggestion[]>}
 */
async function getSuggestionFields(document: DWRest.IDocument, config: IAutoStoreConfig): Promise<DWRest.IDocumentSuggestion[]> {
  let suggestions = await restApi.GetSuggestionFields(document);

  return suggestions.Field.filter(suggestionField => {
    let fieldIndex = document?.Fields?.find(o => o['fieldName'] === suggestionField.Name);
    return !(config.keepPreFilledIndexes === true && fieldIndex?.item.length > 0)
  }).map(suggestionField => {
    let suggestionConfig = config?.suggestions?.find(o => o['name'] === suggestionField.Name);

    if (suggestionConfig &&
      (suggestionConfig.filters && isFilterMatch(suggestionConfig.filters, suggestionField) === true)) {
      return suggestionField;
    }

    if(suggestionConfig && suggestionConfig.name) {
      return suggestionField;
    }

    if(suggestionField?.Value[0]) {
      suggestionField.Value[0].Item = null;
    }

    return suggestionField;
  });
}

/**
* Get allowed intellix trusts from filter configuration
* 
* @param {IAutoStoreConfig} config
* @returns {string|string[]}
*/
function getAllowedIntellixTrust(config: IAutoStoreConfig) {
  let filter = config?.filters?.find(o => o['name'] === INTELLIX_TRUST_NAME);
  return filter?.pattern;
}

/**
 * Traces error
 *
 * @param {Error} error
 * @returns void
 */
function traceError(error: Error) {
  console.error(
    "Error message:\n\r" + error.message //+ "\n\rError Stack:\n\r" + error.stack
  );
}

/**
 * Return true if all filter matches defined glob patterns, otherise false if any one filter fails
 * 
 * @param filters 
 * @param obj 
 * @returns {boolean}
 */
function isFilterMatch(filters: IAutoStoreConfigFilter[], obj: object) {
  return filters.every((filter: IAutoStoreConfigFilter) => {
    return micromatch.isMatch(getProperty(filter.name, obj), filter.pattern, filter.options);
  })
}

/**
 * Get property from object
 * 
 * @see https://github.com/jquense/expr#readme
 * 
 * @param property 
 * @param obj 
 * @returns {any}
 */
function getProperty(property: string, obj: object) {
  let propertyAccessor = expr.getter(property, true);
  return propertyAccessor(obj);
}