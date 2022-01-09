export interface IConfig {
    rootUrl: string,
    user: string,
    password: string,
    organization: string,
    hostID: string,
    autoStore: IAutoStoreConfig[]
}

export interface IAutoStoreConfig {
    fileCabinetID: string,
    documentTrayID: string,
    storeDialogID: string,
    intellixTrust: string[],
    filters: IAutoStoreConfigFilter[],
    keepSource: boolean,
    suggestions: IAutoStoreConfigSuggestion[],
    keepPreFilledIndexes: boolean,
    restrictSuggestions: boolean,
    limit: number,
}

export interface IAutoStoreConfigSuggestion {
    name: string,
    filters: IAutoStoreConfigFilter[]
}

export interface IAutoStoreConfigFilter {
    name: string,
    pattern: string|string[],
    options?: {}
}