import SwaggerParser from '@apidevtools/swagger-parser';
import Parser from 'json-schema-ref-parser';
import JsonPath from 'jsonpath';
import Logger from './logger';
import * as Models from './models/index';
import addFormats from 'ajv-formats';
import Ajv  from 'ajv';
const defaultLog = new Logger('cypress-swagger-validation');

export function SwaggerValidation(config: object) {
  const swaggerSchema: any = [];
  defaultLog.success('Plugin Loaded');

  const getSwaggerSchema = async (
    configuration: Models.IConfig,
    file: string | null
  ): Promise<string | null> => {
    if (
      !file &&
      typeof configuration.env !== 'undefined' &&
      typeof configuration.env.swaggerFile !== 'undefined'
    ) {
      file = configuration.env.swaggerFile;
    } else if (!file) {
      throw new Error('Swagger file was not specified (swaggerFile)');
    }

    if (
      (file && typeof swaggerSchema[file] === 'undefined') ||
      !swaggerSchema[file]
    ) {
      //@ts-ignore
      swaggerSchema[file] = await Parser.dereference(file, {
        dereference: { circular: 'ignore' },
      });
    }
    return swaggerSchema[file];
  };

  return {
    /**
     * @param   {object}        options
     * @param   {string}        options.endpoint
     * @param   {string}        options.method
     * @param   {number}        options.statusCode
     * @param   {object}        options.responseSchema
     * @param   {string}        options.contentType
     * @param   {boolean}       [options.verbose]
     * @param   {string}        [options.file]
     * @returns {string|null}   Errors or null if OK
     */
    validateSwaggerSchema: async (
      options: Models.IOptions
    ): Promise<Error | null> => {
      const log = new Logger('validateSwaggerSchema');
      if (!options.endpoint) {
        return new Error('Endpoint was not specified (endpoint)');
      }
      if (!options.method) {
        return new Error('Method was not specified (method)');
      }
      if (!options.statusCode) {
        return new Error('Status Code was not specified (statusCode)');
      }
      if (!options.responseSchema) {
        return new Error('Response Schema was not specified (responseSchema)');
      }
      if(!options.contentType) {
        options.contentType = 'application/json';
      }

      const verbose = options.verbose || false;
      const schema = await getSwaggerSchema(config, options.file || null);
      const ref =
        "$.paths['" +
        options.endpoint +
        "']." +
        options.method +
        '.responses.' +
        options.statusCode +
        ".content['" +
        options.contentType +
        "'].schema";
      let endpoint = JsonPath.query(schema, ref);

      if (!endpoint || !endpoint.length) {
        return new Error('Could not find Swagger Schema with: ' + ref);
      }

      // The endpoint var should be an array of found items with only 1 item ideally.
      endpoint = endpoint.shift();
      endpoint[0].components = JsonPath.query(schema,'$.components')[0];

      // Now validate the endpoint schema against the response
      const ajv = new Ajv();
            ajv.addKeyword({
                keyword: "components",
                type: "object"});
            ajv.addKeyword({
                keyword: "xml",
                type: "object"});
      addFormats(ajv);

      if (verbose) {
        log.debug('Endpoint:', options.endpoint);
        log.debug(
          'Response Schema:',
          JSON.stringify(options.responseSchema, null, 2)
        );
      }

      const valid = ajv.validate(endpoint, {
        ...options.responseSchema,
        strict: false,
      });
      if (valid && !ajv.errors) {
        if (verbose) {
          log.success('Validation Success');
        }
        return null;
      } else {
        log.error(ajv.errorsText());
        // return ajv.errorsText;
      }
    },

    /**
     * @param   {object}        options
     * @param   {string}        [options.file]
     * @returns {string|null}   Errors or null if OK
     */
    validateSwaggerFile: async (
      options?: Models.IOptions
    ): Promise<Error | null> => {
      const log = new Logger('validateSwaggerFile');
      const schema = await getSwaggerSchema(config, options?.file || null);

      try {
        let api = await SwaggerParser.validate(schema || '', {
          dereference: { circular: 'ignore' },
        });
        log.info('API name: %s, Version: %s', api.info.title, api.info.version);
        return null;
      } catch (err) {
        return err as Error;
      }
    },
  };
}

export default SwaggerValidation;
