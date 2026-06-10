import { BillingRecordService } from '../services/billingRecord.service'
import { createAdminResourceRoute } from './adminResource.route'

export default createAdminResourceRoute(BillingRecordService)

