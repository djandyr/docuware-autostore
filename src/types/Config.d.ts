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
    documentTrayID: string
    intellixTrust: string[],
    documentTitleMask: string,
    keepSource: boolean,
    limit: number
}