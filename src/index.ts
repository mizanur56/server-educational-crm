import 'dotenv/config'
import app from './app.ts'
import { config } from './config.ts'

app.listen(config.port, () => {
  console.log(`CRM API listening on http://localhost:${config.port}`)
})

