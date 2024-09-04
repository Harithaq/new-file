const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const intializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () =>
      console.log(`Server Running at http://localhost:3000/`),
    )
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

intializeDBAndServer()

const convertDbStateObjectToReponse = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDbDistrictObjectToReponse = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

function authenticateToken(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//POST API 1

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `
    SELECT * 
    FROM user
    WHERE 
        username = '${username}'`

  const dbUser = await db.get(selectUserQuery)

  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid User')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)

    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// GET API 2

app.get('/states/', authenticateToken, async (request, response) => {
  const selectUserQuery = `
  SELECT * 
  FROM state`

  const statesArray = await db.all(selectUserQuery)
  response.send(
    statesArray.map(eachState => convertDbStateObjectToReponse(eachState)),
  )
})

// GET API 3

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const selectUserQuery = `
  SELECT * 
  FROM state
  WHERE 
    state_id = ${stateId}`

  const dbUser = await db.get(selectUserQuery)
  response.send(convertDbStateObjectToReponse(dbUser))
})

// POST API 4

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const selectUserQuery = `
  INSERT INTO
  district (district_name, state_id, cases, cured, active, deaths)
  VALUES (
    '${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths}
  )`

  await db.run(selectUserQuery)
  response.send('District Successfully Added')
})

// GET API 5

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const selectUserQuery = `
  SELECT * 
  FROM district
  WHERE 
    district_id = ${districtId}`

    const dbUser = await db.get(selectUserQuery)
    response.send(convertDbDistrictObjectToReponse(dbUser))
  },
)

// DELETE API 6

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteUserQuery = `
  DELETE FROM 
    district 
  WHERE 
    district_id = ${districtId}`

    await db.run(deleteUserQuery)
    response.send('District Removed')
  },
)

// PUT API 7

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body

    const selectUserQuery = `
  UPDATE 
    district
  SET 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
  WHERE 
    district_id = ${districtId}`

    await db.run(selectUserQuery)
    response.send('District Details Updated')
  },
)

// GET API 8

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const selectUserQuery = `
  SELECT 
    SUM(cases) as totalCases,
    SUM(cured) as totalCured,
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths
  FROM 
    district
  WHERE 
    state_id = ${stateId}`

    const dbUser = await db.get(selectUserQuery)
    response.send(dbUser)
  },
)

module.exports = app
