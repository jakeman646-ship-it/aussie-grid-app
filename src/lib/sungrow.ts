export interface SungrowCredentials {
    appKey: string;
    accessKey: string;
  }
  
  export interface SungrowData {
    batteryLevel: number;
    solarPower: number;
    consumption: number;
    gridFlow: string;
  }
  
  // Placeholder function for future real API calls
  export async function fetchSungrowData(_credentials: SungrowCredentials): Promise<SungrowData> {
    // TODO: Replace with real Sungrow API call later
    return {
      batteryLevel: 87,
      solarPower: 4.2,
      consumption: 1.1,
      gridFlow: 'Exporting',
    };
  }