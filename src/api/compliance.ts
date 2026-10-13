import Constants from 'expo-constants';
import { apiClient } from './client';

export type DocumentCategory = 'DRIVER_IDENTITY'|'PSV_LICENSE'|'VEHICLE_OWNERSHIP'|'VEHICLE_INSURANCE'|'E_HAILING_PERMIT';
export type ComplianceDocument = { id:string; category:DocumentCategory; status:string; originalName:string; documentNumber?:string|null; validFrom?:string|null; validUntil?:string|null; rejectionReason?:string|null; createdAt:string; reviewedAt?:string|null };
export type DriverOnboarding = { documents:ComplianceDocument[]; consent:{policyVersion:string;acceptedAt:string}|null; assignedVehicle:{id:string;registrationNumber:string;make?:string|null;model?:string|null}|null; eligibility:{eligible:boolean;reasons:string[]}|null };

export const getDriverOnboarding=async()=> (await apiClient.get<DriverOnboarding>('/compliance/documents/onboarding')).data;
export const acceptDriverConsent=async()=> (await apiClient.post('/compliance/documents/consent',{accepted:true,policyVersion:'apad-privacy-v1',appVersion:Constants.expoConfig?.version})).data;
export const uploadComplianceDocument=async(input:{category:DocumentCategory;asset:{uri:string;name:string;mimeType?:string|null};documentNumber?:string;validUntil?:string;vehicleId?:string})=>{
  const body=new FormData(); body.append('category',input.category);
  if(input.documentNumber) body.append('documentNumber',input.documentNumber.trim());
  if(input.validUntil) body.append('validUntil',input.validUntil.trim());
  if(input.vehicleId) body.append('vehicleId',input.vehicleId);
  body.append('document',{uri:input.asset.uri,name:input.asset.name,type:input.asset.mimeType||'application/octet-stream'} as any);
  return (await apiClient.post('/compliance/documents',body,{headers:{'Content-Type':'multipart/form-data'}})).data;
};
