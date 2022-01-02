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

If a different configuration file path is required

```
npm run start -- --config ./other/config.json
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
            "keepSource": false,
            "limit": 50
        }
    ]
}
```

> JSON Configuration
> 
> * __rootUrl__
> 
>     Root URL of your DocuWare cloud instance
> 
> * __username__
> 
>     Username of full licensed DocuWare cloud user
> 
> * __password__
> 
>    Password of full licensed DocuWare cloud user    
> 
> * __hostID__
> 
>     Unique host identifier for the machine is required. This is used by the DocuWare license management around the faster reuse of licenses of users working on the same machine.
> 
> * __autoStore.fileCabinetID__
> 
>     DocuWare file cabinet GUID
> 
> * __autoStore.documentTrayID__
> 
>     DocuWare document tray GUID, also know as web basket. GUID is usually prefixed with `b_`
>
> * __autoStore.storeDialogID__
> 
>     Store Dialog GUID. Store dialog maybe required if intelligent indexes are not pre-filled when transferring to file cabinet
> 
> * __autoStore.intellixTrust__    
> 
>    List of allowed intellix trusts for autostore task. A source document will be only be stored if `Document.IntellixTrust` property is included in allowed list. If configration array is omitted only "Green" is allowed by default.
> 
>    @see https://developer.docuware.com/dotNet_API_Reference/PlatformServerClient/DocuWare.Platform.ServerClient.IntellixTrust.html
> 
> * __autoStore.documentFilter__    
>    
>    Filter source documents by boolean matching from file cabinet via glob patterns - using wildcards (*, ? and !). Each filter accepts the following parameters:
>    
>    * name {String}: Name of predefined filter
>    * pattern {String|Array}: One or more glob patterns to use for matching.
>    * [options] {Object}: See available [options](https://github.com/micromatch/micromatch#options)
>
>   @see https://github.com/micromatch/micromatch
>    
>   Example configuration to filter documents where title contains partial strings;
>
>   ```
>   [
>       {
>           "name": "title", 
>           "pattern": ["*E2-XH-SADH*", "*X2-XH-SADH*"]
>       }
>   ]
>   ```       
> 
>    Only `title` filter is supported currently
> 
> * __autoStore.keepSource__    
> 
>     If this flag is true the source documents remain in the document tray; otherwise they are removed from document tray
> 
> * __autoStore.limit__ 
> 
>     Limit the number of files returned from document tray for processing
