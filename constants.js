// 1 day forecast (today) includes projected hi/low temps as well as current forecast
export const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather'

export const C_DEGREE = String.fromCharCode(176)

export const C_WINDIR = [
	'N',
	'NNE',
	'NE',
	'ENE',
	'E',
	'ESE',
	'SE',
	'SSE',
	'S',
	'SSW',
	'SW',
	'WSW',
	'W',
	'WNW',
	'NW',
	'NNW',
]

export const VARIABLE_LIST = {
	l_name: { description: 'Location Name', section: '', data: 'name' },
	l_region: { description: 'Region or State (if available)', section: 'sys', data: 'region' },
	l_country: { description: 'Country', section: 'sys', data: 'country' },
	l_localtime: { description: 'Local Time', section: '', data: '' },
	l_timeoffset: { description: 'UTC Offset (minutes)', section: '', data: 'timezone' },
	c_time: { description: 'Time last updated', section: 'time', data: 'dt' },
	c_sunrise: { description: 'Sunrise', section: 'time', data: 'sys.sunrise' },
	c_sunset: { description: 'Sunset', section: 'time', data: 'sys.sunset' },
	c_tempf: { description: 'Temperature (F)', section: 'main', data: 'temp' },
	c_tempc: { description: 'Temperature (C)', section: 'main', data: 'temp' },
	c_tempk: { description: 'Temperature (K)', section: 'main', data: 'temp' },
	c_feelf: { description: 'Feels like (F)', section: 'main', data: 'feels_like' },
	c_feelc: { description: 'Feels like (C)', section: 'main', data: 'feels_like' },
	c_feelk: { description: 'Feels like (K)', section: 'main', data: 'feels_like' },
	c_inhg: { description: 'Pressure inHg', section: 'main', data: 'pressure' },
	c_mmhg: { description: 'Pressure mmHg', section: 'main', data: 'pressure' },
	c_hpa: { description: 'Pressure hPa', section: 'main', data: 'pressure' },
	c_humid: { description: 'Humidity %', section: 'main', data: 'humidity' },
	c_temp: { description: 'Temperature', section: 'local', data: 'temp' },
	c_feels: { description: 'Feels like', section: 'local', data: 'feels_like' },
	c_press: { description: 'Pressure', section: 'local', data: 'pressure' },
	c_wind: { description: 'Wind speed', section: 'local', data: 'speed' },
	c_day: { description: 'Is it daytime?', section: 'internal' },
	c_text: { description: 'Conditions', section: 'weather', data: 'main' },
	c_windi: { description: 'Wind speed MPH', section: 'wind', data: 'speed' },
	c_windm: { description: 'Wind speed MPS', section: 'wind', data: 'speed' },
	c_winddeg: { description: 'Wind degrees', section: 'wind', data: 'deg' },
	c_winddir: { description: 'Wind direction', section: 'internal' },
}
