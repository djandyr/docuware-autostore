import request, { RequestPromiseOptions } from "request-promise-native";
import { DWRequestPromiseExtension } from "./types/DW_Request_Promise_Extension";
import * as DWRest from "./types/DW_Rest";
import http from "http";
import https from "https";
import { exit } from "process";

/**
 * Wrapper for DocuWare REST API
 *
 * @class RestCallWrapper
 */
class RestApiWrapper {
  platformRoot: string;
  docuWare_request_config: RequestPromiseOptions;
  constructor(rootOfPlatform: string, port?: number, timeout?: number) {
    this.platformRoot = port ? `${rootOfPlatform}:${port}` : rootOfPlatform;
    this.docuWare_request_config = {
      baseUrl: rootOfPlatform,
      port,
      timeout: timeout ?? 1000,
      headers: {
        Accept: "application/json",
        "User-Agent": "Ingot CLI",
      },
      withCredentials: true,
      maxRedirects: 5,
      agent: this.platformRoot.startsWith("https")
        ? new https.Agent({ keepAlive: false, port })
        : new http.Agent({ keepAlive: false }),
      json: true,
      resolveWithFullResponse: false
    };
  }

  /**
   * Handles logon and sets cookies to 'global' {RequestPromiseOptions}
   *
   *
   * @param {DWRest.ILogonModel} model
   * @returns {Promise<DWRest.ILogonResponse>}
   */
  Logon(model: DWRest.ILogonModel): Promise<DWRest.ILogonResponse> {
    return new Promise<DWRest.ILogonResponse>((resolve, reject) => {
      return request
        .post("DocuWare/Platform/Account/Logon", {
          ...this.docuWare_request_config,
          form: model,
          resolveWithFullResponse: true,
        })
        .promise()
        .then(
          (logonResponse: DWRequestPromiseExtension.ILogonResponseWrapper) => {
            try {
              const respondedCookies = logonResponse.headers["set-cookie"];
              if (respondedCookies && respondedCookies.length > 0) {
                const cookieJar = request.jar();
                respondedCookies.forEach((cookieString) => {
                  //add cookies to jar
                  cookieJar.setCookie(cookieString, this.platformRoot);
                });
                cookieJar.setCookie("DWFormatCulture=en", this.platformRoot);
                this.docuWare_request_config.jar = cookieJar;
                resolve(logonResponse.body);
              } else {
                reject(new Error("No cookies returned!"));
              }
            } catch (error) {
              reject(error);
            }
          }
        )
        .catch((err) => {
          reject(err);
        });
    });
  }

  /**
   * Returns Organization
   
   * @returns {Promise<DWRest.IOrganization>}
   */
  GetOrganization(): Promise<DWRest.IOrganization> {
    return request
      .get("/DocuWare/Platform/Organization", this.docuWare_request_config)
      .promise();
  }

  /**
   * Returns a special FileCabinet by GUID
   *
   * @param {string} fcGuid
   * @returns {Promise<DWRest.IFileCabinet>}
   */
  GetFileCabinet(fcGuid: string): Promise<DWRest.IFileCabinet> {
    return request
      .get(
        `DocuWare/Platform/FileCabinets/${fcGuid}`,
        this.docuWare_request_config
      )
      .promise();
  }

  /**
   * Get the first x documents from a file cabinet
   *
   * @param {DWRest.IFileCabinet} fileCabinet
   * @param {number} count
   * @returns {Promise<DWRest.IDocumentsQueryResult>}
   */
  GetDocumentQueryResultForSpecifiedCountFromFileCabinet(
    fileCabinet: DWRest.IFileCabinet,
    count: number
  ): Promise<DWRest.IDocumentsQueryResult> {
    return request
      .get(
        `/DocuWare/Platform/FileCabinets/${fileCabinet.Id}/Query/Documents?count=${count}`,
        this.docuWare_request_config
      )
      .promise();
  }

  /**
   * Transfer a number documents from document tray to FileCabinet
   *
   * @param {number[]} docIds
   * @param {string} basketId
   * @param {DWRest.IFileCabinet} fileCabinet
   * @param {boolean} keepSource
   * @returns {Promise<DWRest.DocumentsTransferResult>}
   */
  TransferFromDocumentTrayToFileCabinet(
    docIds: number[],
    basketId: string,
    fileCabinet: DWRest.IFileCabinet,
    keepSource: boolean,
    storeDialogId?: string
  ): Promise<DWRest.IDocumentsQueryResult> {
    const fcTransferInfo: DWRest.IFileCabinetTransferInfo = {
      KeepSource: keepSource,
      SourceDocId: docIds,
      SourceFileCabinetId: basketId,
      FillIntellix: true
    };

    let transferLink: string = this.GetLink(fileCabinet, "transfer");

    // Force store dialog 
    // DocuWare API fails to determine default store dialog transferring documents to file cabinet without pre-filled intelligent index values
    if (storeDialogId) {
      transferLink += `?StoreDialogId=${storeDialogId}`;
    }

    return request
      .post(transferLink, {
        ...this.docuWare_request_config,
        body: fcTransferInfo,
        headers: {
          "Content-Type":
            DWRest.DocuWareSpecificContentType.FileCabinetTransferInfoJson,
        },
      }).promise();
  }

  /**
   * Helper function for preparing the logon
   *
   * @param {string} user
   * @param {string} pw
   * @param {string} org
   * @returns {DWRest.ILogonModel}
   */
  CreateLogonModel(
    user: string,
    pw: string,
    org: string,
    hostID: string
  ): DWRest.ILogonModel {
    return {
      Username: user,
      Password: pw,
      Organization: org,
      HostID: hostID,
      RedirectToMyselfInCaseOfError: false,
      RememberMe: true,
    };
  }

  /**
   * Helper method to check if link exists or not
   *
   * @param {DWRest.ILinkModel} linkModel
   * @param {string} linkName
   * @returns {string}
   */
  private GetLink(linkModel: DWRest.ILinkModel, linkName: string): string {
    const theLink: string | null = this.GetLinkFromModel(linkModel, linkName);

    if (!theLink) {
      throw new Error(`No ${linkName} link found!`);
    }

    return theLink;
  }

  /**
   * Get link from object by name
   *
   * @param {DWRest.ILinkModel} linkModel
   * @param {string} linkName
   * @returns {(string | null)}
   */
  private GetLinkFromModel(
    linkModel: DWRest.ILinkModel,
    linkName: string
  ): string | null {
    if (linkModel.Links) {
      const theRealLink = linkModel.Links.find(
        (l) => l.rel.toLowerCase() === linkName.toLowerCase()
      );
      if (theRealLink) {
        return theRealLink.href;
      }
    }

    return null;
  }
}

export { RestApiWrapper };