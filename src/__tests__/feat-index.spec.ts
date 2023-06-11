import { execApi } from ".."

describe('example', () => {

  it('index execApi all pattern', async () => {
    try {
      await execApi()
    } catch(e) {
      throw e
    }
  })

})
