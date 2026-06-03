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
