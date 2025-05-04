/* eslint-disable no-useless-escape */

// openweathermap.org interface

import { combineRgb, Regex } from '@companion-module/base'
import { runEntrypoint, InstanceBase, InstanceStatus } from '@companion-module/base'
import { Jimp, JimpMime } from 'jimp'
import { UpgradeScripts } from './upgrades.js'
import rest_pkg from 'node-rest-client'
const rest_client = rest_pkg.Client

import { BASE_URL, C_DEGREE, C_WINDIR, VARIABLE_LIST } from './constants.js'

/**
 * Companion instance class openweather-rest
 * Control module for Open Weather API
 *
 * @extends InstanceBase
 * @version 2.0.0
 * @since 2.0.0
 * @author John A Knight, Jr <istnv@istnv.com>
 */
class OWInstance extends InstanceBase {
	/**
	 * add leading zeros to num, trim to len
	 * -- this will truncate num if it has more than 'len' digits
	 *
	 * @param {*} num
	 * @param {*} len
	 * @returns
	 */

	pad0(num, len = 2) {
		const zeros = '0'.repeat(len)
		return (zeros + num).slice(-len)
	}

	/**
	 * Create an instance of the openweather-api module
	 *
	 * @param {Object} internal - holds the instance ID and flags
	 * @since 2.0.0
	 */
	constructor(internal) {
		super(internal)
	}

	/**
	 * Main initialization function called once the module
	 * is OK to start doing things.
	 *
	 * @since 2.0.0
	 */
	async init(config) {
		if (config.tz == null) {
			config.tz = 'h'
			this.saveConfig(config)
		}
		this.config = config
		this.init_vars()

		// other init methods
		this.init_feedbacks(this)
		this.init_presets()
		this.init_actions()
		this.init_connection()
	}

	/**
	 * Process an updated configuration array.
	 * called from companion when user changes the configuration
	 *
	 * @param {Object} config - the new configuration
	 * @since 2.0.0
	 */
	async configUpdated(config) {
		// save passed config
		this.config = config

		// tear everything down
		this.destroy()

		// ... and start again
		this.init_actions()
		this.init_feedbacks(this)
		this.init_presets()
		this.init_connection()
	}

	/**
	 * Clean up the instance before it is destroyed
	 * or configuration is re-processed
	 *
	 * @since 2.0.0
	 */
	destroy() {
		if (this.heartbeat) {
			clearInterval(this.heartbeat)
			delete this.heartbeat
		}
		this.init_vars()
		if (this.client) {
			delete this.client
		}
	}

	/**
	 * Creates the configuration fields for web config.
	 * called from companion when the config page is shown
	 *
	 * @returns {Array} the config fields
	 * @since 2.0.0
	 */
	getConfigFields() {
		this.REGEX_HEX = '/^[0-9A-Fa-f]+$/'

		const configs = [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value:
					'This module retrieves weather information from OpenWeathermap.org.<br>It requires an active internet connection.',
			},
			{
				type: 'textinput',
				id: 'apikey',
				label: 'API Key',
				width: 12,
				tooltip: 'Enter your API Key from OpenWeathermap.com.',
				regex: this.REGEX_HEX,
			},
			{
				type: 'textinput',
				id: 'location',
				label: 'Location',
				tooltip: 'Weather Location to Display',
				width: 12,
			},
			{
				type: 'dropdown',
				id: 'units',
				label: 'Measurement Units',
				width: 6,
				default: 'i',
				choices: [
					{ id: 'i', label: 'Fahrenheit and MPH' },
					{ id: 'm', label: 'Celsius and kPH' },
				],
			},
			{
				type: 'dropdown',
				id: 'tz',
				label: 'Timezone',
				width: 6,
				default: 'l',
				choices: [
					{ id: 'l', label: 'Times use location configured above' },
					{ id: 'h', label: 'Times use local (Companion) time' },
					{ id: 'u', label: 'Times are UTC' },
				],
			},
			{
				type: 'textinput',
				id: 'refresh',
				label: 'Refresh Frequency',
				tooltip: 'Reload current weather after # of minutes',
				width: 6,
				default: '20',
				regex: Regex.NUMBER,
			},
		]
		return configs
	}

	/**
	 * Setup the actions.
	 *
	 * @since 2.0.0
	 */
	init_actions() {
		this.setActionDefinitions({
			refresh: {
				name: 'Refresh',
				options: [],
				callback: async (action, context) => {
					this.refresh()
				},
			},
		})
	}

	/**
	 * Generate the feedbacks available
	 *
	 * @since 2.0.0
	 */
	init_feedbacks() {
		// only one, replace button 'background' with
		// the recommended Icon from OpenWeather
		const feedbacks = {
			icon: {
				type: 'advanced',
				name: 'Current Condition Icon',
				description: 'Change background to icon of current weather',
				options: [],
				callback: async (feedback, bank) => {
					let ret
					if (this.icons[this.iconID]) {
						ret = { png64: this.icons[this.iconID] }
						ret.bgcolor = this.isDay ? combineRgb(200, 200, 200) : combineRgb(16, 16, 16)
						ret.color = this.isDay ? combineRgb(32, 32, 32) : combineRgb(168, 168, 168)
					}
					if (ret) {
						return ret
					}
				},
			},
		}
		this.setFeedbackDefinitions(feedbacks)
	}

	/**
	 * initialize internal status variables
	 * and the variable definitions available to companion
	 *
	 * @since 2.0.0
	 */
	init_vars() {
		let vars = []

		this.weather = {
			location: {},
			current: {},
			forecast: {},
		}
		this.update = this.config.refresh * 60000
		this.lastPolled = 0
		this.icons = {}
		this.iconID = ''
		this.mph = 'i' == this.config.units
		this.hasError = false
		for (let i in VARIABLE_LIST) {
			vars.push({ variableId: i, name: VARIABLE_LIST[i].description })
		}
		this.setVariableDefinitions(vars)
	}

	/**
	 * build presets for the buttons
	 *
	 * @since 2.0.0
	 */
	init_presets() {
		const presets = {
			'pic-and-temp': {
				type: 'button',
				category: 'Example',
				name: 'Condition Graphic & Current Temp',
				style: {
					text: '$(ow:c_text)\\n$(ow:c_temp)',
					size: '18',
					color: combineRgb(255, 255, 255),
					bgcolor: 0,
				},
				steps: [
					{
						down: [],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'icon',
						style: {},
						options: {},
					},
				],
			},
		}
		this.setPresetDefinitions(presets)
	}

	/**
	 * initialize the API connection
	 *
	 * @since 2.0.0
	 */
	init_connection() {
		if (this.client) {
			delete this.client
		}
		if (this.heartbeat) {
			clearInterval(this.heartbeat)
			delete this.heartbeat
		}
		this.client = new rest_client()

		// only connect when API key is defined
		if (this.config.apikey === undefined || this.config.apikey == '') {
			this.updateStatus(InstanceStatus.BadConfig, 'Missing API key')
			return
		}

		this.updateStatus(InstanceStatus.Connecting)

		this.client.on('error', (err) => {
			this.updateStatus(InstanceStatus.ConnectionFailure, err)
			this.hasError = true
		})

		// check every minute
		this.heartbeat = setInterval(() => {
			this.pulse()
		}, 60000)
		// starting now :)
		this.refresh()
	}

	/**
	 * Check if over 20 minutes since last refresh
	 *
	 * @since 2.0.0
	 */
	pulse() {
		let short = this.lastPolled + this.update - Date.now()
		// if over 20 minutes then refresh
		if (short <= 0) {
			this.refresh()
		}
	}

	/**
	 * Submit a new query for the most recent data
	 *
	 * @since 2.0.0
	 */
	refresh() {
		// Only query if more than 1 minute since last poll
		if (!this.hasError && this.lastPolled + 60000 <= Date.now()) {
			let url = `${BASE_URL}?q=${this.config.location}&appid=${this.config.apikey}`
			this.lastPolled = Date.now()
			this.client
				.get(url, (data, response) => {
					if (data.error) {
						this.log('error', data.error.message)
						this.updateStatus(InstanceStatus.UnknownError, data.error.message)
						this.hasError = true
					} else if (response.statusCode == 200) {
						this.updateStatus(InstanceStatus.Ok, 'Connected')
						//this.log('info','Weather data updated')
						this.update_variables(data)
					} else {
						this.log('error', data.message)
						this.updateStatus(InstanceStatus.UnknownError, data.message)
						this.init_vars()
						this.setVariableValues({ l_name: data.message })
					}
				})
				.on('error', (err) => {
					let emsg = err.message
					this.log('error', emsg)
					this.updateStatus(InstanceStatus.Error, emsg)
				})
		}
	}

	/**
	 * update the module variables
	 *
	 * @param {Object} data - information returned from the API
	 * @since 2.0.0
	 */
	update_variables(data) {
		let v = VARIABLE_LIST
		let dv = ''
		let dt = data.dt
		let vars = {}
		let tz = data.timezone
		const p0 = this.pad0

		switch (this.config.tz) {
			case 'h': // here
				const now = new Date()
				tz = -now.getTimezoneOffset() * 60 // convert to seconds
				break
			case 'u': // UTC
				tz = 0
				break
		}

		this.weather = data

		// Additional 'date' formatting functions
		Date.prototype.toHHMM = function () {
			return p0(this.getUTCHours()) + ':' + p0(this.getUTCMinutes())
		}

		Date.prototype.toMMDD_HHMM = function () {
			return p0(this.getUTCMonth() + 1) + '-' + p0(this.getUTCDate()) + ' ' + this.toHHMM()
		}

		function kelvinToUnit(units, p) {
			let ret

			switch (units) {
				case 'f':
					ret = Math.floor(((p - 273.15) * 9) / 5 + 32.49) + C_DEGREE
					break
				case 'c':
					ret = Math.floor(p - 273.15 + 0.49) + C_DEGREE
					break
				default:
					ret = Math.floor(p + 0.49) + C_DEGREE
			}
			return ret
		}

		function hpaToUnit(units, p) {
			let ret

			switch (units) {
				case 'i':
					ret = parseFloat(Math.floor((p / 33.863886666667) * 100) / 100)
					break
				case 'm':
					ret = Math.floor((p / 133.322387415) * 100)
					break
				default:
					ret = p
					break
			}
			return ret
		}
		function speedToUnit(units, p) {
			let ret = p
			switch (units) {
				case 'm':
					ret = Math.floor(p * 100 + 0.49) / 100
					break
				case 'i':
					ret = Math.floor(p * 22.3694 + 0.49) / 10
					break
			}
			return ret
		}

		for (let i in v) {
			let k = v[i].section
			let p = data[k] ? data[k][v[i].data] : data[v[i].data]
			switch (k) {
				case '':
					if ('l_localtime' == i) {
						const now = new Date()
						const utc = now.getTime() // Convert local time to UTC
						dv = new Date()
						dv.setTime(utc + tz * 1000)
						dv = dv.toMMDD_HHMM() // Add the offset in milliseconds
					} else {
						dv = data[v[i].data]
					}
					break
				case 'local':
					switch (i) {
						case 'c_feels':
						case 'c_temp':
							dv = kelvinToUnit(this.mph ? 'f' : 'c', data.main[v[i].data])
							break
						case 'c_press':
							dv = hpaToUnit(this.mph ? 'i' : 'm', data.main[v[i].data])
							break
						case 'c_wind':
							dv = speedToUnit(this.mph ? 'i' : 'm', data.wind[v[i].data])
							break
					}
					break
				case 'main':
					switch (i) {
						case 'c_inhg':
						case 'c_mmhg':
						case 'c_hpa':
							dv = hpaToUnit(i.slice(2, 3), p)
							break
						case 'c_humid':
							dv = p + '%'
							break
						case 'c_tempk':
						case 'c_feelk':
						case 'c_tempc':
						case 'c_feelc':
						case 'c_tempf':
						case 'c_feelf':
							dv = kelvinToUnit(i.slice(-1), p)
							break
					}
					break
				case 'sys':
					dv = data[k][v[i].data]
					break
				case 'wind':
					dv = speedToUnit(i.slice(-1), data[k][v[i].data])
					break
				case 'weather':
					dv = data.weather[0][v[i].data]
					// get/update the corresponding graphic
					this.update_graphic(data.weather)
					break
				case 'internal':
					if (i == 'c_winddir') {
						const d = data.wind.deg
						dv = C_WINDIR[Math.floor((d % 360) / 22.5 + 0.5) % 16]
					} else if (i == 'c_day') {
						dv = dt > data.sys.sunrise && dt < data.sys.sunset
						this.isDay = dv
					}
					break
				case 'time':
					let d = new Date()
					switch (i) {
						case 'c_time':
							d.setTime((dt + tz) * 1000)
							dv = d.toMMDD_HHMM()
							break
						case 'c_sunrise':
							d.setTime((data.sys.sunrise + tz) * 1000)
							dv = d.toHHMM()
							break
						case 'c_sunset':
							d.setTime((data.sys.sunset + tz) * 1000)
							dv = d.toHHMM()
							break
					}
					break
				case 'forecast':
					break
			}
			vars[i] = dv
		}
		this.setVariableValues(vars)
	}

	/**
	 * Update the feedback icon when requested
	 *
	 * @param {Object} cond - current 'conditions' with recommended Icon ID
	 * @since 2.0.0
	 */

	update_graphic(cond) {
		const code = cond[0].icon

		if (code != this.iconID) {
			this.iconID = code
			// cached?
			if (this.icons[code]) {
				this.checkFeedbacks('icon')
			} else {
				// retrieve icon
				this.client
					.get(`http://openweathermap.org/img/wn/${code}@2x.png`, async (data, response) => {
						if (response.statusCode == 200) {
							const image = await Jimp.read(Buffer.from(data))
							const png = await image.scaleToFit({ w: 72, h: 72 }).getBase64(JimpMime.png)
							this.icons[code] = png
							this.checkFeedbacks('icon')
						}
						// this.icons[code] = data.toString('base64');
						// this.checkFeedbacks('icon');}
					})
					.on('error', (err) => {
						let emsg = err.message
						this.log('error', emsg)
						this.updateStatus(InstanceStatus.Error, emsg)
					})
			}
		}
	}
}

runEntrypoint(OWInstance, UpgradeScripts)
