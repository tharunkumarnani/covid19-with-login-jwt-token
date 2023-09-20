const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const bcrypt = require("bcrypt");
app.use(express.json());

let db;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at 3000");
    });
  } catch (e) {
    console.log(`DB error :${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//1.login user api

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    select * from user where username='${username}';`;
  const userDetails = await db.get(selectUserQuery);

  if (userDetails === undefined) {
    //Invalid User
    response.status(400);
    response.send("Invalid user");
  } else {
    //check password
    const isValidPassword = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (isValidPassword) {
      //return jwt Token
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "my_secret_code");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// middleware authenticate token function for all apis

const authenticateToken = (request, response, next) => {
  console.log("Message from Middleware Function : Authenticating.....");

  const authHeader = request.headers["authorization"];

  if (authHeader === undefined) {
    //Invalid jwt token

    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    //verify jwt token
    let jwtToken = authHeader.split(" ")[1];
    jwt.verify(jwtToken, "my_secret_code", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        console.log(
          "Message from Middleware Function : Authentication Success"
        );
        next();
      }
    });
  }
};

//2. get states api

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    select  state_id as stateId,state_name as stateName,population
    from state ;
    `;
  const statesDetails = await db.all(getStatesQuery);
  response.send(statesDetails);
});

//3.get state api

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    select state_id as stateId,state_name as stateName,population
    from state
    where state_id=${stateId};`;
  const stateDetails = await db.get(getStateQuery);

  response.send(stateDetails);
});

//4.get districts api

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
    insert into district
    (district_name,state_id,cases,cured,active,deaths)
    values ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//5. get state api

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    select district_id as districtId,district_name as districtName,state_id as stateId,cases,cured,active,deaths
    from district
    where district_id=${districtId};`;
    const districtDetails = await db.get(getDistrictQuery);
    response.send(districtDetails);
  }
);

//6. Delete district api

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    delete from district
    where district_id=${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//7.Update district api

app.put(
  "/districts/:districtId/",
  authenticateToken,
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
    const updateDistrictQuery = `
    update district
    set district_name='${districtName}',
        state_id=${stateId},
        cases=${cases},
        cured=${cured},
        active=${active},
        deaths=${deaths}
    where
      district_id=${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//8. get statistics of total cases,cured,active,deaths of a state

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatisticsQuery = `
    select sum(cases)as totalCases,sum(cured)as totalCured,sum(active)as totalActive,sum(deaths)as totalDeaths
    from state natural join district
    where state_id=${stateId}
    group by state_id;`;
    const getStatsDetails = await db.get(getStateStatisticsQuery);
    response.send(getStatsDetails);
  }
);

module.exports = app;
