import { JustaName, type ChainId } from "@justaname.id/sdk";

const CONFLUX_ENS_DOMAIN = "conflux.eth";
const CHAIN_ID = 11155111 as ChainId; // Sepolia for ENS

let justaNameInstance: JustaName | null = null;

async function getJustaName(): Promise<JustaName> {
  if (!justaNameInstance) {
    justaNameInstance = JustaName.init({
      config: {
        domain: typeof window !== "undefined" ? window.location.host : "",
        origin: typeof window !== "undefined" ? window.location.origin : "",
      },
      ensDomains: [
        {
          chainId: CHAIN_ID,
          ensDomain: CONFLUX_ENS_DOMAIN,
          apiKey: process.env.NEXT_PUBLIC_JUSTANAME_API_KEY,
        },
      ],
      defaultChainId: CHAIN_ID,
    });
  }
  return justaNameInstance;
}

export async function isUsernameAvailable(
  username: string
): Promise<boolean> {
  try {
    const justaName = await getJustaName();
    const result = await justaName.subnames.isSubnameAvailable({
      subname: `${username}.${CONFLUX_ENS_DOMAIN}`,
      chainId: CHAIN_ID,
    });
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function addSubname(
  username: string,
  address: string
): Promise<boolean> {
  const apiKey = process.env.NEXT_PUBLIC_JUSTANAME_API_KEY;
  if (!apiKey) {
    console.error("NEXT_PUBLIC_JUSTANAME_API_KEY not set");
    return false;
  }

  try {
    const justaName = await getJustaName();
    await justaName.subnames.addSubname(
      {
        username,
        chainId: CHAIN_ID,
        apiKey,
        overrideSignatureCheck: true,
      },
      {
        xAddress: address,
        xMessage: "",
      }
    );
    return true;
  } catch (error) {
    console.error("Failed to register ENS subname:", error);
    return false;
  }
}

export async function getPrimaryName(
  address: string
): Promise<string | null> {
  try {
    const justaName = await getJustaName();
    const result = await justaName.subnames.getPrimaryNameByAddress({
      address,
      chainId: CHAIN_ID,
    });
    return result?.name ?? null;
  } catch {
    return null;
  }
}

export function formatSubname(username: string): string {
  return `${username}.${CONFLUX_ENS_DOMAIN}`;
}
