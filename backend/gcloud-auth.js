import { spawn } from 'node:child_process'
import { AuthClient } from 'google-auth-library'
import { request as gaxiosRequest } from 'gaxios'

const ASSUMED_LIFETIME_MS = 55 * 60 * 1000
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000

function runGcloud(args) {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32'
    const cmd = isWin ? 'gcloud.cmd' : 'gcloud'
    const proc = spawn(cmd, args, { shell: isWin, windowsHide: true })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(`gcloud ${args.join(' ')} exited ${code}: ${stderr.trim()}`))
    })
  })
}

export class GcloudCliAuthClient extends AuthClient {
  constructor(account) {
    super()
    this._account = account || null
    this._token = null
    this._expiry = 0
    this._inflight = null
  }

  async _refresh() {
    if (this._inflight) return this._inflight
    this._inflight = (async () => {
      try {
        const args = ['auth', 'print-access-token']
        if (this._account) args.push('--account', this._account)
        const token = await runGcloud(args)
        this._token = token
        this._expiry = Date.now() + ASSUMED_LIFETIME_MS
        return token
      } finally {
        this._inflight = null
      }
    })()
    return this._inflight
  }

  async getAccessToken() {
    if (!this._token || Date.now() > this._expiry - REFRESH_THRESHOLD_MS) {
      await this._refresh()
    }
    return { token: this._token }
  }

  async getRequestHeaders() {
    const { token } = await this.getAccessToken()
    return new Headers({ authorization: `Bearer ${token}` })
  }

  async request(opts) {
    const headers = new Headers(opts.headers || {})
    const { token } = await this.getAccessToken()
    headers.set('authorization', `Bearer ${token}`)
    return gaxiosRequest({ ...opts, headers })
  }
}
