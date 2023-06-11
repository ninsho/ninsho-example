/*
  COMMAND SAMPLE:
  $ npm install
  $ docker-compose -f docker-pg.yml up --build
  $ npx ninsho-cli@latest create-table
  $ npm run dev
*/

/**
 * Declaring Required Packages
 * 
 * Please install in advance.
 * $ npm i ninsho
 * $ npm i ninsho-module-secure ninsho-module-pg ninsho-module-mailer
 * $ npm i ninsho-plugin-essential-api ninsho-plugin-immediately-api ninsho-plugin-standard-2fa-api
 * $ npm i ninsho-hook-account-lock
 */
import { ninsho } from 'ninsho'
import ModSecure from 'ninsho-module-secure'
import ModPg from 'ninsho-module-pg'
import ModMailer from 'ninsho-module-mailer'
import EssentialPI from 'ninsho-plugin-essential-api'
import ImmediatelyAPI from 'ninsho-plugin-immediately-api'
import Standard2faAPI from 'ninsho-plugin-standard-2fa-api'
import AccountLockHook from 'ninsho-hook-account-lock'

/**
 * Database connection information and email configuration information are written
 * in the .env file and loaded using dotenv.
 */
import * as dotenv from 'dotenv'
dotenv.config()
const env = process.env as any;

/**
 * step1:
 * Set up the database in advance.
 * This is necessary for all APIs.
 */
const pool = ModPg.init({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'postgres',
  port: 5432,
  max: 10,
  statement_timeout: 10000,
})

/**
 * step2:
 * Set up secure configurations such as passwords in advance.
 * This is necessary for all APIs.
 */
const secure = ModSecure.init({
  secretKey: 'Abracadabra'
})

/**
 * step3:
 * Set up email information in advance. This depends on Nodemailer.
 * This is required when using APIs that trigger email sending.
 */
import * as nodemailer from 'nodemailer';
const mailer = ModMailer.init(
  nodemailer.createTransport(
    {
      service: 'Gmail',
      auth: {
        user: env.MAILER_USER,
        pass: env.MAILER_PASS
      }
    }
  ),
  {
    SendMailAddress: env.MAILER_USER,
    throwOnReplaceFailed: true
  }
)

/**
 * step4:
 * Initialize 'ninsho' using the database, email, and secure configurations.
 * The "as const" in plugins is mandatory.
 * If you remove the '.plugins' at the end, it will become 'n',
 * which can reference 'options' and 'plugins'.
 */
export const n = new ninsho({
  pool: pool,
  mailer: mailer,
  secure: secure,
  options: {
    sessionExpirationSec: 86400 * 30,
  },
  plugins: [
    ImmediatelyAPI.init(),
    EssentialPI.init(),
    Standard2faAPI.init({
      JWTExpirationSec: 120,
      secretKey: 'Abracadabra'
    })
  ] as const
}).plugins;

/**
 * step5:
 * Create request information.
 * Normally, you would create an API backend with Express or Fastify and use what you get from there.
 * Here, we will test using fixed values.
 * Please change the email as appropriate.
 */
const user = {
  name: 'test_user',
  pass: 'test_pass',
  mail: 'test@localhost',
  ip: '127.0.0.0',
  sessionDevice: 'user-device',
  custom: {
    tel: '000-0000-0000',
    nickname: 'example user',
    address: 'private'
  },
  userCredentials: {
    sessionToken: '',
    alternateToken: '',
    otp: ''
  }
};
type Custom = {
  tel?: string
  nickname?: string
  address?: string
}

/**
 * step6:
 * Let's actually try making a request.
 */
(() => {
  // Ignore this operation during testing
  if ((process.env.NODE_ENV !== 'test')) {
    execApi()
  }
})();

export async function execApi() {

  await pool.truncate(['sessions', 'members'])

  /**
   * Check if registered with the username.
   * 
   * For the sake of visibility in operation verification, we're going through 'replyManager',
   * but in reality, it's quite simple as follows.
   * 
   * ```
   * n.DefaultAPI.findUser(user.name).then(
   *   res => {
   *     if (res.fail()) {
   *       // fail process    
   *     } else {
   *       // success process
   *     }
   *   }
   * )
   * ```
   */
  replyManager('DefaultAPI.findUser', await n.DefaultAPI.findUser(
    user.name
  ), user.userCredentials, 200)

  /**
   * Register a user without two-factor authentication.
   * If two-factor authentication is required, please use Standard2faAPI.
   */
  replyManager('EssentialAPI.createUser', await n.EssentialAPI.createUser<Custom>(
    user.name,
    user.mail,
    user.pass,
    user.ip,
    user.sessionDevice,
    user.custom
  ), user.userCredentials, 201)

  /**
   * Confirm the session.
   */
  replyManager('DefaultAPI.session', await n.DefaultAPI.session(
    user.userCredentials.sessionToken,
    user.ip,
    user.sessionDevice
  ), null, 200)

  /**
   * Retrieve user details.
   */
  replyManager('DefaultAPI.getProps', await n.DefaultAPI.getProps(
    user.userCredentials.sessionToken,
    user.ip,
    user.sessionDevice
  ), null, 200)

  /**
   * Update custom columns. If you set options.clear: true, it will be formed only with what you set.
   */
  replyManager('DefaultAPI.updateCustom', await n.DefaultAPI.updateCustom<Custom>(
    {
      tel: '999-9999-9999'
    },
    user.userCredentials.sessionToken,
    user.ip,
    user.sessionDevice
  ), null, 200)

  /**
   * User deletion
   */
  replyManager('EssentialAPI.deleteUser', await n.EssentialAPI.deleteUser(
    user.userCredentials.sessionToken,
    user.ip,
    user.sessionDevice
  ), null, 204)

  /**
   * Confirm that a deleted user causes an error when checking the session.
   */
  replyManager('DefaultAPI.session(expect 404 { replyCode: [ 1050, 2008 ] })', await n.DefaultAPI.session(
    user.userCredentials.sessionToken,
    user.ip,
    user.sessionDevice
  ), null, 401)

  /**
   * Register a user with two-factor authentication.
   * Here, we set sending of the one-time password to false, and retrieve it from response.system.
   * If you want to deliver it, please do so after properly setting up ModMailer.
   */
  replyManager('Standard2faAPI.createUser2faFirst', await n.Standard2faAPI.createUser2faFirst(
    user.name,
    user.mail,
    user.pass,
    user.ip,
    user.custom,
    {
      sendCompleatNotice: false
    }
  ), user.userCredentials, 201)

  /**
   * Two-factor authentication for user registration.
   * By setting "sendCompleatNotice: false", the registration completion email will not be delivered.
   * If you want to deliver it, please do so after properly setting up ModMailer.
   */
  replyManager('Standard2faAPI.createUser2faVerify', await n.Standard2faAPI.createUser2faVerify(
    user.userCredentials.otp,
    user.userCredentials.alternateToken,
    user.ip,
    user.sessionDevice,
    {
      sendCompleatNotice: false
    }
  ), user.userCredentials, 200)

  /**
   * AccountLock hook sample. except 401, 401, 429
   */
  for (let expectStatusCode of [401, 401, 429]) {
    replyManager('ImmediatelyAPI.loginUser with AccountLockHook', await n.ImmediatelyAPI.loginUser(
      user.name,
      user.mail,
      'bad password',
      user.ip,
      user.sessionDevice,
      {
        sendCompleatNotice: false,
        columnToRetrieve: [
          'failed_attempts',
          'last_failed_attempts_at'
        ],
        hooks: [
          {
            hookPoint: 'beforePasswordCheck',
            hook: AccountLockHook(
              3, // failures_allowed_limit
              60 * 60 * 24, // account_unlock_duration_sec
              {
                sendLockNotice: false,
              }
            )
          },
        ]
      }
    ), user.userCredentials, expectStatusCode)
  }

}

/**
 * General process for operation confirmation.
 */
let count = 0;
function replyManager(
  apiName: string,
  res: any,
  userCredentials?: typeof user['userCredentials'] | any,
  expectStatusCode?: number,
) {
  
  // logs test only
  if ((process.env.NODE_ENV !== 'test')) {
    console.log(`[REQUEST:${++count}]`, apiName, ' => ', res.statusCode, res.body)
  }
  
  // test failed
  if (expectStatusCode && res?.statusCode != expectStatusCode) throw {
    message: `different than expected. ${apiName} expected: ${expectStatusCode}, Actual: ${res?.statusCode}`
  }
  
  // api failed
  if (res.fail()) {
    return;
  }

  if (!userCredentials) return

  if (res?.body?.session_token) {
    userCredentials.sessionToken = res.body.session_token
  }
  if (res?.body?.alternate_token) {
    userCredentials.alternateToken = res.body.alternate_token
  }
  if (res?.system?.alternate_token) {
    userCredentials.alternateToken = res.system.alternate_token
  }
  if (res?.system?.one_time_password) {
    userCredentials.otp = res.system.one_time_password
  }
}
