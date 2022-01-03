# Docuware Autostore

Automatically store documents from document tray to file cabinet using DocuWare REST API. Multiple tasks can be configured with different trays, intellix trusts levels, document title masks and processing limits.

This script addresses lack of automation within DocuWare cloud that forces logged in user to manually store each document in their tray, even if the intelligent indexing confidence score is high (green). For scenarios where DocuWare is used to intelligently index large volumes of archived documents or emails any manual intervention can quickly become unmaintainable.

![DocuWare AutoStore](docuware-autostore.png)

## Install

Install Node Packages

```
npm install
```

Compile the code so it can be run, also required if any typescript files are changed

```
npx tsc
```

Create a new config.json autostore configuration in root folder. See [Example Configuration](#configuration)

Run AutoStore

```
npm run start --silent
```

## Command Arguments

`--config` to specify a different configuration file path other than default `./config.json`

```
npm run start -- --config ./other/config.json
```

` --dry-run` option to have autostore print document details without transferring any documents to file cabinet. This option can be used for testing filter patterns, or intellix trust levels.

```
npm run start -- --dry-run
```

## Configuration

```
{
    "rootUrl": "https://my.docuware.cloud/",
    "user": "username",
    "password": "password",
    "hostID": "7b5ed19b-bfd6-46e9-8a3b-efd2a4499666",
    "autoStore": [
        {
            "fileCabinetID": "c74e4dbb-51ec-4594-a74d-125a9af52b66",
            "documentTrayID": "b_243312da-a455-4eb2-adf3-6e8d75e9eed4",
            "storeDialogID": "c08ad9a4-2017-4705-b5d0-14dc3b84a5fe",
            "intellixTrust": [
                "Green",
                "Yellow"
            ],
            "keepSource": false
        }
    ]
}
```

### Configuration Reference

* __rootUrl__

    Root URL of your DocuWare cloud instance

* __username__

    Username of full licensed DocuWare cloud user

* __password__

   Password of full licensed DocuWare cloud user    

* __hostID__

    Unique host identifier for the machine is required. This is used by the DocuWare license management around the faster reuse of licenses of users working on the same machine.

* __autoStore.fileCabinetID__

    DocuWare file cabinet GUID

* __autoStore.documentTrayID__

    DocuWare document tray GUID, also know as web basket. GUID is usually prefixed with `b_`
>
* __autoStore.storeDialogID__

    Store Dialog GUID. Store dialog maybe required if intelligent indexes are not pre-filled when transferring to file cabinet

* __autoStore.intellixTrust__    

   List of allowed [intellix trusts](https://developer.docuware.com/dotNet_API_Reference/PlatformServerClient/DocuWare.Platform.ServerClient.IntellixTrust.html). A source document will be only be stored if `Document.IntellixTrust` property is included in allowed list. If configration array is omitted only "Green" is allowed by default.

* __autoStore.filters__    
   
   Filter source documents with boolean matching glob patterns using wildcards (*, ? and !). Each filter accepts the following parameters:
   
   * name {String}: [Document property](https://developer.docuware.com/dotNet_API_Reference/PlatformServerClient/DocuWare.Platform.ServerClient.Document.html#properties) name (can be accessed using dot notation)
   * pattern {String|Array}: One or more glob patterns. See available [matching features](https://github.com/micromatch/micromatch#matching-features)
   * [options] {Object}: See available [options](https://github.com/micromatch/micromatch#options)
   
   Example configuration to filter documents where [Title](https://developer.docuware.com/dotNet_API_Reference/PlatformServerClient/DocuWare.Platform.ServerClient.Document.html#DocuWare_Platform_ServerClient_Document_Title) contains one or more partial strings;

      [
          {
              "name": "Title", 
              "pattern": ["*E2-XH-SADH*", "*X2-XH-SADH*"]
          }
      ]  

* __autoStore.keepSource__    

    If this flag is true the source documents remain in the document tray; otherwise they are removed from document tray

* __autoStore.limit__ 

    Limit the number of files returned from document tray for processing. Default set to 100
