const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jsonwebtoken = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running http://localhost:3000/");
    });
  } catch (err) {
    console.log(`DB Error is ${err.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT
        *
    FROM
        user
    WHERE
      username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  //   console.log(dbUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const comparePassword = await bcrypt.compare(password, dbUser.password);
    // console.log(comparePassword);
    if (comparePassword) {
      const payload = {
        username: username,
      };
      const jwtToken = jsonwebtoken.sign(payload, "karthik");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authentication = (request, response, next) => {
  let jwt;
  const header = request.headers["authorization"];
  //   console.log(header);
  if (header !== undefined) {
    jwt = header.split(" ")[1];
    // console.log(jwt);
  }
  if (jwt === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jsonwebtoken.verify(jwt, "karthik", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
const convertNames = (each) => {
  return {
    stateId: each.state_id,
    stateName: each.state_name,
    population: each.population,
  };
};

app.get("/states/", authentication, async (request, response) => {
  const selectQueryDetails = `
    SELECT 
      *
    FROM
      state;`;
  const dbUser = await db.all(selectQueryDetails);
  response.send(dbUser.map((each) => convertNames(each)));
});

app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const selectQueryDetails = `
    SELECT 
      *
    FROM
      state
    WHERE 
      state_id = '${stateId}';`;
  const dbUser = await db.get(selectQueryDetails);
  response.send({
    stateId: dbUser.state_id,
    stateName: dbUser.state_name,
    population: dbUser.population,
  });
});

app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postQueryDetails = `
  INSERT INTO
    district(district_name, state_id, cases, cured, active, deaths)
  VALUES
    (
        '${districtName}',
        '${stateId}',
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}'
    );`;
  const dbUser = await db.run(postQueryDetails);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const selectQueryDetails = `
    SELECT 
      *
    FROM
      district
    WHERE 
      district_id = '${districtId}';`;
    const dbUser = await db.get(selectQueryDetails);
    response.send({
      districtId: dbUser.district_id,
      districtName: dbUser.district_name,
      stateId: dbUser.state_id,
      cases: dbUser.cases,
      cured: dbUser.cured,
      active: dbUser.active,
      deaths: dbUser.deaths,
    });
  }
);

app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQueryDetails = `
    DELETE FROM
      district
    WHERE 
      district_id = '${districtId}'`;
    const dbUser = await db.run(deleteQueryDetails);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const putQueryDetails = `
    UPDATE 
      district
    SET
      district_name = '${districtName}',
      state_id = '${stateId}',
      cases = '${cases}',
      cured = '${cured}',
      active = '${active}',
      deaths = '${deaths}'
    WHERE 
      district_id = '${districtId}'`;
    const dbUser = await db.run(putQueryDetails);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const selectQueryDetails = `
    SELECT 
      SUM(cases) AS totalCases,
      SUM(cured) AS totalCured,
      SUM(active) AS totalActive,
      SUM(deaths) AS totalDeaths
    FROM
      state NATURAL JOIN district 
    WHERE 
      state_id = '${stateId}';`;
    const dbUser = await db.get(selectQueryDetails);
    response.send(dbUser);
  }
);

module.exports = app;
