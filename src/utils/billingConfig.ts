import BillingConfigModel from '@/server/models/BillingConfigModel';

export type BillingConfigDTO = {
    taskPublishCostRub: number;
    bidCostRub: number;
};

const DEFAULT_CONFIG: BillingConfigDTO = {
    taskPublishCostRub: 100,
    bidCostRub: 50,
};

export const ensureBillingConfig = async (): Promise<void> => {
    const exists = await BillingConfigModel.findOne({}).lean();
    if (exists) return;
    await BillingConfigModel.create(DEFAULT_CONFIG);
};

export const getBillingConfig = async (): Promise<BillingConfigDTO> => {
    const doc = await BillingConfigModel.findOne({}).lean();
    if (!doc) {
        await BillingConfigModel.create(DEFAULT_CONFIG);
        return { ...DEFAULT_CONFIG };
    }
    return {
        taskPublishCostRub: typeof doc.taskPublishCostRub === 'number' ? doc.taskPublishCostRub : DEFAULT_CONFIG.taskPublishCostRub,
        bidCostRub: typeof doc.bidCostRub === 'number' ? doc.bidCostRub : DEFAULT_CONFIG.bidCostRub,
    };
};

export const updateBillingConfig = async (payload: Partial<BillingConfigDTO>) => {
    await ensureBillingConfig();
    const next = {
        taskPublishCostRub:
            typeof payload.taskPublishCostRub === 'number' ? payload.taskPublishCostRub : undefined,
        bidCostRub: typeof payload.bidCostRub === 'number' ? payload.bidCostRub : undefined,
    };
    const saved = await BillingConfigModel.findOneAndUpdate(
        {},
        { $set: { ...next, updatedAt: new Date() } },
        { new: true }
    ).lean();
    if (!saved) {
        throw new Error('BILLING_CONFIG_UPDATE_FAILED');
    }
    return {
        taskPublishCostRub: saved.taskPublishCostRub ?? DEFAULT_CONFIG.taskPublishCostRub,
        bidCostRub: saved.bidCostRub ?? DEFAULT_CONFIG.bidCostRub,
    };
};
