import { execApi } from "../index"

describe('example', () => {

  it('index execApi all pattern', async () => {
    try {
      await execApi()
    } catch(e) {
      console.log('fail')
      throw e
    }
  })

})
