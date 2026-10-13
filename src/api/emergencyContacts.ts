import {apiClient} from './client';
export type EmergencyContact={id:string;name:string;phone:string;relation?:string|null;isPrimary:boolean};
export const getEmergencyContacts=async()=> (await apiClient.get<EmergencyContact[]>('/alerts/sos/contacts/mine')).data;
export const addEmergencyContact=async(input:{name:string;phone:string;relation?:string;isPrimary?:boolean})=> (await apiClient.post<EmergencyContact>('/alerts/sos/contacts',input)).data;
export const removeEmergencyContact=async(id:string)=> apiClient.delete(`/alerts/sos/contacts/${id}`);
