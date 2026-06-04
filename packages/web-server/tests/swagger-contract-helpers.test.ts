import {
  createErrorResponses,
  createSuccessResponseWithExample,
  schemaRef,
} from '../src/swagger-contract-helpers';

describe('swagger contract helpers', () => {
  test('builds shared error response maps from one structured error example', () => {
    expect(createErrorResponses({
      '400': 'Missing or invalid payload',
      '500': 'Unexpected server error',
    }, {
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Missing or invalid payload',
      },
      timestamp: 1700000000000,
    })).toEqual({
      '400': {
        description: 'Missing or invalid payload',
        content: {
          'application/json': {
            schema: schemaRef('StructuredApiErrorResponse'),
            example: {
              success: false,
              error: {
                code: 'BAD_REQUEST',
                message: 'Missing or invalid payload',
              },
              timestamp: 1700000000000,
            },
          },
        },
      },
      '500': {
        description: 'Unexpected server error',
        content: {
          'application/json': {
            schema: schemaRef('StructuredApiErrorResponse'),
            example: {
              success: false,
              error: {
                code: 'BAD_REQUEST',
                message: 'Missing or invalid payload',
              },
              timestamp: 1700000000000,
            },
          },
        },
      },
    });
  });

  test('builds success responses that keep the shared envelope schema while attaching a fixed example', () => {
    expect(createSuccessResponseWithExample(
      'Server runtime ports',
      'ServerRuntimeConfigPayload',
      {
        api: { port: 4000, url: 'http://localhost:4000' },
        websocket: { port: 4001, url: 'ws://localhost:4001' },
      },
    )).toEqual({
      description: 'Server runtime ports',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['success', 'data', 'timestamp'],
            properties: {
              success: { type: 'boolean', enum: [true] },
              data: schemaRef('ServerRuntimeConfigPayload'),
              timestamp: { type: 'number' },
            },
          },
          example: {
            success: true,
            data: {
              api: { port: 4000, url: 'http://localhost:4000' },
              websocket: { port: 4001, url: 'ws://localhost:4001' },
            },
            timestamp: 1700000000000,
          },
        },
      },
    });
  });
});
