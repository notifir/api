const request = require("supertest");
const { GenericContainer } = require("testcontainers");
require("dotenv").config();

const { DB_DATABASE, DB_USER, DB_PASSWORD } = process.env;
const PORT = 4444

jest.setTimeout(30000);

let pgContainer;
let app;
let knexClient

beforeAll(async () => {
  pgContainer = await new GenericContainer("postgres:11-alpine")
    .withEnv("POSTGRES_USER", DB_USER)
    .withEnv("POSTGRES_PASSWORD", DB_PASSWORD)
    .withEnv("POSTGRES_DB", DB_DATABASE)
    .withExposedPorts(5432)
    .start();

  process.env.DB_PORT = pgContainer.getMappedPort(5432);
  process.env.PORT = PORT;

  app = require("../src/app");
  knexClient = require("../src/db");

  await knexClient.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knexClient.migrate.latest();
  await knexClient.seed.run();
});

afterAll(async done => {
  await knexClient.destroy()
  await pgContainer.stop()

  done()
});

describe("testing /notifications route", () => {

  it('should return 401 if \'x-api-key\' header is not set', async done => {
    const { body: errorResult } = await request(app)
      .post("/api/notifications")
      .expect(401)

    expect(errorResult).toStrictEqual({
      error: "unauthorized",
      message: "Missing required header 'x-api-key'",
    })
    done()
  })

  it('should return 401 if \'x-user-id\' header is not set', async done => {
    const { body: errorResult } = await request(app)
      .post("/api/notifications")
      .set('x-api-key', '114ee1da-067b-11ed-be0f-6f24634ae754')
      .expect(401)

    expect(errorResult).toStrictEqual({
      error: "unauthorized",
      message: "Missing required header 'x-user-id'",
    })
    done()
  })

  it('should return 401 if \'x-user-hmac\' header is not set', async done => {
    const { body: errorResult } = await request(app)
      .post("/api/notifications")
      .set('x-api-key', '114ee1da-067b-11ed-be0f-6f24634ae754')
      .set('x-user-id', 'test')
      .expect(401)

    expect(errorResult).toStrictEqual({
      error: "unauthorized",
      message: "Missing required header 'x-user-hmac'",
    })
    done()
  })

  it('should return 403 if user does not have permission to create notification', async done => {
    const { body: errorResult } = await request(app)
      .post("/api/notifications")
      .set('x-api-key', '114ee1da-067b-11ed-be0f-6f24634ae754')
      .set('x-user-id', 'test')
      .set('x-user-hmac', '4WMzNnwDX8oLI5uK0GDHG7K9bavlT4+0k0xepm4Q1MY=')
      .expect(403)

    expect(errorResult).toStrictEqual({
      error: "forbidden",
      message: "User test doesn't have permission to create notifications",
    })
    done()
  })

  it('should return 400 if notification type is not set', async done => {
    const { body: errorResult } = await request(app)
      .post("/api/notifications")
      .set('x-api-key', '114ee1da-067b-11ed-be0f-6f24634ae754')
      .set('x-user-id', 'system')
      .set('x-user-hmac', '0+TZm7uauwGAqJOavzGEr8aBqUwJo3vXOb6tPxiVCYM=')
      .expect(400)

    expect(errorResult).toStrictEqual({
      error: "bad_request",
      message: "Field 'type' is required and cannot be empty.",
    })
    done()
  })

  it('should return 400 if notification recipient is not specified', async done => {
    const data = {
      type: "test-notification"
    }
    const { body: errorResult } = await request(app)
      .post("/api/notifications")
      .set('x-api-key', '114ee1da-067b-11ed-be0f-6f24634ae754')
      .set('x-user-id', 'system')
      .set('x-user-hmac', '0+TZm7uauwGAqJOavzGEr8aBqUwJo3vXOb6tPxiVCYM=')
      .send(data)
      .expect(400)

    expect(errorResult).toStrictEqual({
      error: "bad_request",
      message: "Field 'recipient' is required and cannot be empty.",
    })
    done()
  })

  it('should return 400 if notification recipient field is empty', async done => {
    const data = {
      type: "test-notification",
      recipient: ""
    }
    const { body: errorResult } = await request(app)
      .post("/api/notifications")
      .set('x-api-key', '114ee1da-067b-11ed-be0f-6f24634ae754')
      .set('x-user-id', 'system')
      .set('x-user-hmac', '0+TZm7uauwGAqJOavzGEr8aBqUwJo3vXOb6tPxiVCYM=')
      .send(data)
      .expect(400)

    expect(errorResult).toStrictEqual({
      error: "bad_request",
      message: "Field 'recipient' is required and cannot be empty.",
    })
    done()
  })

  it('should return 201 and create notification', async done => {
    const data = {
      type: "test-notification",
      recipient: "test"
    }
    const { body: result } = await request(app)
      .post("/api/notifications")
      .set('x-api-key', '114ee1da-067b-11ed-be0f-6f24634ae754')
      .set('x-user-id', 'system')
      .set('x-user-hmac', '0+TZm7uauwGAqJOavzGEr8aBqUwJo3vXOb6tPxiVCYM=')
      .send(data)
      .expect(201)

    expect(result).toHaveProperty('notifications')
    expect(result.notifications).toBeInstanceOf(Array)
    expect(result.notifications).toHaveLength(1)
    expect(result.notifications[0]).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
      }),
    )
    done()
  })
});
