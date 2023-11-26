import { DynamoDBClient, UpdateItemCommand, AttributeValue } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';

const ddbClient = new DynamoDBClient({ region: process.env.REGION });
const TableName = process.env.TABLE_NAME;

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        const { movieId, reviewerName } = event.pathParameters || {};
        const body = event.body ? JSON.parse(event.body) : null;

        const { content } = body;
        if (typeof content !== 'string') {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ error: 'Invalid request body format.' }),
            };
        }

        const updateParams = {
            TableName,
            Key: {
                movieId: { N: movieId },
                reviewerName: { S: reviewerName },
            },
            UpdateExpression: 'SET content = :content',
            ExpressionAttributeValues: {
                ':content': { S: content },
            },
            ReturnValues: 'ALL_NEW',
        };

        // @ts-ignore
        const updateCommand = new UpdateItemCommand(updateParams);
        const result = await ddbClient.send(updateCommand);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: 'Review updated successfully', data: result.Attributes }),
        };
    } catch (error: any) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Internal Server Error' }),
        };
    }
};