import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        console.log("Event: ", event);

        const pathParameters = event?.pathParameters;
        const movieId = pathParameters?.movieId ? parseInt(pathParameters.movieId) : undefined;

        if (!movieId) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ Message: "Invalid movie Id" }),
            };
        }

        const queryStringParameters = event?.queryStringParameters;
        const minRating = queryStringParameters?.minRating;

        const commandInput = {
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: "movieId = :m",
            ExpressionAttributeValues: {
                ":m": movieId,
            },
        };

        if (minRating) {
            // @ts-ignore
            commandInput.FilterExpression = "rating > :minRating";
            // @ts-ignore
            commandInput.ExpressionAttributeValues[":minRating"] = Number(minRating);
        }
        const commandOutput = await ddbDocClient.send(
            new QueryCommand(commandInput)
        );

        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                data: commandOutput.Items,
            }),
        };
    } catch (error: any) {
        console.log(JSON.stringify(error));
        return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ error }),
        };
    }
};

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
    const marshallOptions = {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
        wrapNumbers: false,
    };
    const translateConfig = { marshallOptions, unmarshallOptions };
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}