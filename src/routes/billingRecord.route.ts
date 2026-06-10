import { BillingRecordService } from '../services/billingRecord.service'
import { createReadonlyUserResourceRoute } from './userResource.route'

export default createReadonlyUserResourceRoute(BillingRecordService)
