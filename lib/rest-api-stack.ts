import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import {Construct} from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import {generateBatch} from "../shared/util";
import {movies, movieCasts} from "../seed/movies";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
import {AuthApi} from "./auth-api";
import {UserPool} from "aws-cdk-lib/aws-cognito";

export class RestAPIStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props?: cdk.StackProps ) {
        super(scope, id, props);

        const userPool = new UserPool(this, "UserPool", {
            signInAliases: { username: true, email: true },
            selfSignUpEnabled: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        const userPoolId = userPool.userPoolId;

        const appClient = userPool.addClient("AppClient", {
            authFlows: { userPassword: true },
        });

        const userPoolClientId = appClient.userPoolClientId;

        new AuthApi(this, 'AuthServiceApi', {
            userPoolId: userPoolId,
            userPoolClientId: userPoolClientId,
        });


        // Tables
        const moviesTable = new dynamodb.Table(this, "MoviesTable", {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: {name: "movieId", type: dynamodb.AttributeType.NUMBER},
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            tableName: "Movies",
        });

        const newMovieFn = new lambdanode.NodejsFunction(this, "AddMovieFn", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/../lambdas/addMovie.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                TABLE_NAME: moviesTable.tableName,
                REGION: "eu-west-1",
            },
        });

        const movieCastsTable = new dynamodb.Table(this, "MovieCastTable", {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: {name: "movieId", type: dynamodb.AttributeType.NUMBER},
            sortKey: {name: "actorName", type: dynamodb.AttributeType.STRING},
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            tableName: "MovieCast",
        });

        movieCastsTable.addLocalSecondaryIndex({
            indexName: "roleIx",
            sortKey: {name: "roleName", type: dynamodb.AttributeType.STRING},
        });

        const movieReviewsTable = new dynamodb.Table(this, "MovieReviewsTable", {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: {name: "movieId", type: dynamodb.AttributeType.NUMBER},
            sortKey: {name: "reviewerName", type: dynamodb.AttributeType.STRING},
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            tableName: "MovieReviews",
        });

        const newReviewFn = new lambdanode.NodejsFunction(this, "newReviewFn", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/../lambdas/addReview.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "eu-west-1",
            },
        });

        // Functions
        const getMovieByIdFn = new lambdanode.NodejsFunction(
            this,
            "GetMovieByIdFn",
            {
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_16_X,
                entry: `${__dirname}/../lambdas/getMovieById.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    TABLE_NAME: moviesTable.tableName,
                    REGION: 'eu-west-1',
                    CAST: ''
                },
            }
        );

        const deleteMovieByIdFn = new lambdanode.NodejsFunction(
            this,
            "deleteMovieByIdFn",
            {
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_16_X,
                entry: `${__dirname}/../lambdas/deleteMovie.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    TABLE_NAME: moviesTable.tableName,
                    REGION: 'eu-west-1',
                },
            }
        );

        const getAllMoviesFn = new lambdanode.NodejsFunction(
            this,
            "GetAllMoviesFn",
            {
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_16_X,
                entry: `${__dirname}/../lambdas/getAllMovies.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    TABLE_NAME: moviesTable.tableName,
                    REGION: 'eu-west-1',
                },
            }
        );

        const getMovieCastMembersFn = new lambdanode.NodejsFunction(
            this,
            "GetCastMemberFn",
            {
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_16_X,
                entry: `${__dirname}/../lambdas/getMovieCastMember.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    TABLE_NAME: movieCastsTable.tableName,
                    REGION: "eu-west-1",
                },
            }
        );

        const getReviewsForMovieFn  = new lambdanode.NodejsFunction(
            this,
            "getReviewsForMovieFn",
            {
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_16_X,
                entry: `${__dirname}/../lambdas/getMovieReview.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    TABLE_NAME: movieReviewsTable.tableName,
                    REGION: "eu-west-1",
                },
            }
        );

        const getAllReviewsByReviewerName  = new lambdanode.NodejsFunction(
            this,
            "getAllReviewsByReviewerName",
            {
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_16_X,
                entry: `${__dirname}/../lambdas/getAllReviewsByReviewerName.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    TABLE_NAME: movieReviewsTable.tableName,
                    REGION: "eu-west-1",
                },
            }
        );

        const getReviewsForMovieByReviewerNameFn  = new lambdanode.NodejsFunction(
            this,
            "getReviewsForMovieByReviewerNameFn",
            {
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_16_X,
                entry: `${__dirname}/../lambdas/getMovieReviewByReviewerName.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    TABLE_NAME: movieReviewsTable.tableName,
                    REGION: "eu-west-1",
                },
            }
        );

        const updateReviewFn = new lambdanode.NodejsFunction(
            this,
            "updateReviewFn",
            {
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_16_X,
                entry: `${__dirname}/../lambdas/updateReview.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    TABLE_NAME: movieReviewsTable.tableName,
                    REGION: "eu-west-1",
                },
            }
        );


        new custom.AwsCustomResource(this, "moviesddbInitData", {
            onCreate: {
                service: "DynamoDB",
                action: "batchWriteItem",
                parameters: {
                    RequestItems: {
                        [moviesTable.tableName]: generateBatch(movies),
                        [movieCastsTable.tableName]: generateBatch(movieCasts),  // Added
                      //  [movieReviewsTable.tableName]: generateBatch(movieReviews),  // Added
                    },
                },
                physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"), //.of(Date.now().toString()),
            },
            policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
                resources: [moviesTable.tableArn, movieCastsTable.tableArn, movieReviewsTable.tableArn],  // Includes movie cast
            }),
        });

        // Permissions 
        moviesTable.grantReadData(getMovieByIdFn)
        moviesTable.grantReadData(deleteMovieByIdFn)
        moviesTable.grantReadData(getAllMoviesFn)
        moviesTable.grantReadWriteData(newMovieFn)
        movieCastsTable.grantReadData(getMovieCastMembersFn);
        movieReviewsTable.grantReadWriteData(newReviewFn);
        movieReviewsTable.grantReadWriteData(getReviewsForMovieFn);
        movieReviewsTable.grantReadWriteData(updateReviewFn);
        movieReviewsTable.grantReadData(getReviewsForMovieByReviewerNameFn);
        movieReviewsTable.grantReadData(getAllReviewsByReviewerName);


        const api = new apig.RestApi(this, "RestAPI", {
            description: "demo api",
            deployOptions: {
                stageName: "dev",
            },
            // 👇 enable CORS
            defaultCorsPreflightOptions: {
                allowHeaders: ["Content-Type", "X-Amz-Date"],
                allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
                allowCredentials: true,
                allowOrigins: ["*"],
            },
        });



        // ------------------ Authorization -------------

        // const protectedRes = api.root.addResource("protected");
        //
        // const publicRes = api.root.addResource("public");
        //
        // const protectedFn = new node.NodejsFunction(this, "ProtectedFn", {
        //     ...appCommonFnProps,
        //     entry: "./lambda/protected.ts",
        // });
        //
        // const publicFn = new node.NodejsFunction(this, "PublicFn", {
        //     ...appCommonFnProps,
        //     entry: "./lambda/public.ts",
        // });
        //
        // const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
        //     ...appCommonFnProps,
        //     entry: "./lambda/auth/authorizer.ts",
        // });
        //
        //
        // const requestAuthorizer = new apig.RequestAuthorizer(
        //     this,
        //     "RequestAuthorizer",
        //     {
        //         identitySources: [apig.IdentitySource.header("cookie")],
        //         handler: authorizerFn,
        //         resultsCacheTtl: cdk.Duration.minutes(0),
        //     }
        // );


        // ------------------------------

        const moviesEndpoint = api.root.addResource("movies");
        moviesEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getAllMoviesFn, {proxy: true})
        );
        moviesEndpoint.addMethod("POST", new apig.LambdaIntegration(newMovieFn), {
            // authorizer: requestAuthorizer,
            // authorizationType: apig.AuthorizationType.CUSTOM,
        });
        moviesEndpoint.addMethod(
            "DELETE",
            new apig.LambdaIntegration(deleteMovieByIdFn, {proxy: true})
        );

        // /movies/reviews
        const reviewsPostEndpoint = moviesEndpoint.addResource("reviews");
        reviewsPostEndpoint.addMethod("POST", new apig.LambdaIntegration(newReviewFn, { proxy: true }));

        // Add GET /movies/reviews/{reviewerName}
        const reviewsByReviewerNameEndpoint = reviewsPostEndpoint.addResource("{reviewerName}");
        reviewsByReviewerNameEndpoint.addMethod("GET", new apig.LambdaIntegration(getAllReviewsByReviewerName, { proxy: true }));


        const movieEndpoint = moviesEndpoint.addResource("{movieId}");
        movieEndpoint.addMethod("GET", new apig.LambdaIntegration(getMovieByIdFn, { proxy: true }));

        // Add GET /movies/{movieId}/reviews/
        const reviewsEndpoint = movieEndpoint.addResource("reviews");
        reviewsEndpoint.addMethod("GET", new apig.LambdaIntegration(getReviewsForMovieFn, { proxy: true }));

// Add GET /movies/{movieId}/reviews/{reviewerName}
// Add PUT /movies/{movieId}/reviews/{reviewerName}
        const reviewerNameReviewsEndpoint = reviewsEndpoint.addResource("{reviewerName}")
        reviewerNameReviewsEndpoint.addMethod("GET", new apig.LambdaIntegration(getReviewsForMovieByReviewerNameFn, { proxy: true }));
        reviewerNameReviewsEndpoint.addMethod("PUT", new apig.LambdaIntegration(updateReviewFn, { proxy: true }));

    }
}
    