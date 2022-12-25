// type EmptyObject = {
//   [key: string]: unknown
// }

type EpochTimeStamp = number

export interface I_USER {
  id: number
  client_id: string
  email: string
  password: string
  access_token: string
  refresh_token: string
  last_login_date: EpochTimeStamp
  a_token_valid_till?: EpochTimeStamp
  r_token_valid_till?: EpochTimeStamp
  registration_date: EpochTimeStamp
  force_logout: boolean
}
