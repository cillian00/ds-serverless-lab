    import { APIGatewayProxyHandlerV2 } from "aws-lambda";
    import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
    import {
        DynamoDBDocumentClient,
        QueryCommand,
        QueryCommandInput,
    } from "@aws-sdk/lib-dynamodb";
    import Ajv from "ajv";
    import schema from "../shared/types.schema.json";

    const ajv = new Ajv();
    const isValidQueryParams = ajv.compile(
        schema.definitions["MovieReviewsQueryParams"] || {}
    );

    const ddbDocClient = createDocumentClient();

    export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
        try {
            console.log("Event: ", event);

            const { movieId, reviewerName } = event.pathParameters || {};
            if (!movieId || !reviewerName) {
                return {
                    statusCode: 400,
                    headers: {
                        "content-type": "application/json",
                    },
                    body: JSON.stringify({ message: "Missing path parameters" }),
                };
            }

            const queryParams = event.queryStringParameters;
            if (queryParams && !isValidQueryParams(queryParams)) {
                return {
                    statusCode: 400,
                    headers: {
                        "content-type": "application/json",
                    },
                    body: JSON.stringify({
                        message: `Incorrect type. Must match Query parameters schema`,
                        schema: schema.definitions["MovieReviewsQueryParams"],
                    }),
                };
            }

            // Parse movieId to integer
            const parsedMovieId = parseInt(movieId);

            let commandInput: QueryCommandInput = {
                TableName: process.env.TABLE_NAME,
                KeyConditionExpression: "movieId = :m and begins_with(reviewerName, :a)",
                ExpressionAttributeValues: {
                    ":m": parsedMovieId,
                    ":a": reviewerName,
                },
            };

            // Add additional conditions based on queryParams if needed
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

    function createDocumentClient() {
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