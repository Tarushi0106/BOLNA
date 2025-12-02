const mongoose = require('mongoose')
const callSchema = new mongoose.Schema({
  Phone: String,
  Call: String,
  tomorrow: String,
  Name: String,
  Summary: String,
  wifi_as_a_Service: String,
  Low_latency_multi_cloud_connectivity: String,
  Data_Centres: String,
  SD_WAN: String
},{timestamps:true})
module.exports = mongoose.model('balnaCalls', callSchema, 'calls')
