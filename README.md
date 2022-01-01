# Docuware Autostore

Automatically store documents from document tray to file cabinet using DocuWare REST API. Multiple tasks can be configured with different trays, intellix trusts levels, document title masks and processing limits.

This script addresses lack of automation in DocuWare cloud trays which forces logged in user to manually store each document, even if the intelligent indexing confidence score is high (green). For scenarios where DocuWare is used to intelligently index large volumes of archived documents or emails any manual intervention can quickly become unmaintainable.

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
    "user": "andy.roberts@warrant-group.com",
    "password": "yourpassword",
    "hostID": "7b5ed19b-bfd6-46e9-8a3b-efd2a4499666",
    "autoStore": [
        {
            "fileCabinetID": "c74e4dbb-51ec-4594-a74d-125a9af52b66",
            "documentTrayID": "b_243312da-a455-4eb2-adf3-6e8d75e9eed4",
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
>     Username of fully licensed DocuWare user
> 
> * __password__
> 
>    Password of fully licensed DocuWare user    
> 
> * __hostID__
> 
>     Sets unique identifier of the machine the client is running.
> 
> * __autoStore.fileCabinetID__
> 
>     DocuWare file cabinet GUID
> 
> * __autoStore.documentTrayID__
> 
>     DocuWare document tray GUID, also know as web basket. GUID is usually prefixed with `b_`
> 
> * __autoStore.intellixTrust__    
> 
>    List of allowed intellix trusts enums for a specific autostore task. Documents will be stored if enums matches the intellix trust assigned to document. If no enums are defined for tasks all intellix trusts are allowed.
> 
> * __autoStore.documentTitleMask__    
> 
>     Regular expression pattern on document title which can include/exclude documents from file cabinet
> 
> * __autoStore.keepSource__    
> 
>     Whether document should be deleted from document tray after storing
> 
> * __autoStore.fileCabinetLimit__ 
> 
>     Limit the number of files returned from document tray for processing
