export interface IOptions {
    file?: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseSchema: object;
    contentType: string;
    verbose?: boolean;
}
