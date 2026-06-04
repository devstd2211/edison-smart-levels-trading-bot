export const schemaRef = (name: string) => ({
  $ref: `#/components/schemas/${name}`,
});

export const createSuccessEnvelopeSchema = (dataSchema: Record<string, unknown>) => ({
  type: 'object',
  required: ['success', 'data', 'timestamp'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: dataSchema,
    timestamp: { type: 'number' },
  },
});

export const createSuccessResponse = (description: string, schemaName: string) => ({
  description,
  content: {
    'application/json': {
      schema: createSuccessEnvelopeSchema(schemaRef(schemaName)),
    },
  },
});

export const createSuccessResponseWithExample = (
  description: string,
  schemaName: string,
  dataExample: unknown,
  timestamp: number = 1700000000000,
) => ({
  description,
  content: {
    'application/json': {
      schema: createSuccessEnvelopeSchema(schemaRef(schemaName)),
      example: {
        success: true,
        data: dataExample,
        timestamp,
      },
    },
  },
});

type ResponseMapSuccessOptions = {
  description: string;
  schemaName: string;
  statusCode?: string;
  dataExample?: unknown;
  timestamp?: number;
};

type ResponseMapOptions =
  | {
    success: ResponseMapSuccessOptions;
    errors?: undefined;
    errorExample?: undefined;
  }
  | {
    success: ResponseMapSuccessOptions;
    errors: Record<string, string>;
    errorExample: unknown;
  };

export const createErrorResponse = (
  description: string,
  example: unknown,
) => ({
  description,
  content: {
    'application/json': {
      schema: schemaRef('StructuredApiErrorResponse'),
      example,
    },
  },
});

export const createErrorResponses = (
  descriptions: Record<string, string>,
  example: unknown,
) =>
  Object.fromEntries(
    Object.entries(descriptions).map(([statusCode, description]) => [
      statusCode,
      createErrorResponse(description, example),
    ]),
  );

export const createResponseMap = (
  options: ResponseMapOptions,
) => {
  let errorResponses: Record<string, unknown> = {};
  if ('errors' in options) {
    const errorOptions = options as Extract<ResponseMapOptions, { errors: Record<string, string> }>;
    errorResponses = createErrorResponses(errorOptions.errors, errorOptions.errorExample);
  }

  return {
    [options.success.statusCode ?? '200']: options.success.dataExample === undefined
      ? createSuccessResponse(options.success.description, options.success.schemaName)
      : createSuccessResponseWithExample(
        options.success.description,
        options.success.schemaName,
        options.success.dataExample,
        options.success.timestamp,
      ),
    ...errorResponses,
  };
};

export const createJsonRequestBody = (schemaName: string, required: boolean = true) => ({
  required,
  content: {
    'application/json': {
      schema: schemaRef(schemaName),
    },
  },
});

export const createSchemaAlias = (schemaName: string) => ({
  allOf: [schemaRef(schemaName)],
});

export const createConfigBackupCollectionSchema = () => ({
  type: 'object',
  required: ['backups', 'count'],
  properties: {
    backups: {
      type: 'array',
      items: schemaRef('ConfigBackupPayload'),
    },
    count: { type: 'number' },
  },
});

export const createConfigActionMessageSchema = (
  properties: Record<string, unknown>,
  required: string[],
) => ({
  type: 'object',
  required: ['message', ...required],
  properties: {
    message: { type: 'string' },
    ...properties,
  },
});

export const createConfigValidationPayloadSchema = () => ({
  type: 'object',
  required: ['valid', 'errors', 'warnings', 'summary'],
  properties: {
    valid: { type: 'boolean' },
    errors: {
      type: 'array',
      items: schemaRef('ConfigValidationIssuePayload'),
    },
    warnings: {
      type: 'array',
      items: schemaRef('ConfigValidationIssuePayload'),
    },
    summary: schemaRef('ConfigValidationSummaryPayload'),
  },
});

export const createConfigMutationPreviewPayloadSchema = () => ({
  type: 'object',
  required: ['changes', 'summary', 'validation'],
  properties: {
    changes: {
      type: 'array',
      items: schemaRef('ConfigMutationPreviewEntryPayload'),
    },
    summary: schemaRef('ConfigMutationPreviewSummaryPayload'),
    validation: schemaRef('ConfigValidationResponsePayload'),
  },
});

export const createConfigMutationRequestPayloadSchema = () => ({
  type: 'object',
  required: ['config'],
  properties: {
    config: schemaRef('BotConfigPayload'),
  },
});
