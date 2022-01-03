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
    filters: [],
    fields: [],
    keepSource: boolean,
    limit: number
}

export interface IAutoStoreConfigFilter {
    name: string,
    pattern: string,
    options: {}
}