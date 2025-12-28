import 'server-only';

// src/server/models/OrganizationModel.ts

import mongoose, { Schema, Document, models, model } from 'mongoose';

type OrgPlan = 'basic' | 'pro' | 'business' | 'enterprise';
type LegalForm = 'ООО' | 'ИП' | 'АО' | 'ЗАО';

export interface CompanyProfile {
    plan?: OrgPlan;
    legalForm?: LegalForm;
    organizationName?: string;
    legalAddress?: string;
    inn?: string;
    kpp?: string;
    ogrn?: string;
    okpo?: string;
    bik?: string;
    bankName?: string;
    correspondentAccount?: string;
    settlementAccount?: string;
    directorTitle?: string;
    directorName?: string;
    directorBasis?: string;
    contacts?: string;
}

export interface Organization extends Document {
    name: string;
    orgSlug: string;
    slug?: string;
    ownerEmail: string;
    createdByEmail: string;
    createdAt: Date;
    companyProfile?: CompanyProfile;
}

const OrganizationSchema = new Schema<Organization>(
    {
        name: { type: String, required: true },
        orgSlug: { type: String, required: true, unique: true, index: true },
        slug: { type: String, unique: true, sparse: true },
        ownerEmail: { type: String, required: true, index: true },
        createdByEmail: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        companyProfile: {
            plan: { type: String, enum: ['basic', 'pro', 'business', 'enterprise'], default: 'basic' },
            legalForm: { type: String, enum: ['ООО', 'ИП', 'АО', 'ЗАО'] },
            organizationName: { type: String },
            legalAddress: { type: String },
            inn: { type: String },
            kpp: { type: String },
            ogrn: { type: String },
            okpo: { type: String },
            bik: { type: String },
            bankName: { type: String },
            correspondentAccount: { type: String },
            settlementAccount: { type: String },
            directorTitle: { type: String },
            directorName: { type: String },
            directorBasis: { type: String },
            contacts: { type: String },
        },
    },
    { timestamps: true }
);

export default (models.Organization as mongoose.Model<Organization>) ||
model<Organization>('Organization', OrganizationSchema);
