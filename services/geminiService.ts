
// Fix: Changed import to remove deprecated 'GenerateContentStreamResponse' and add 'Chat' for type safety.
import { GoogleGenAI, GenerateContentResponse, Modality, Type, Chat } from "@google/genai";
import { ChatMessage } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

// A.1 Ankauf Chat
// Fix: Replaced deprecated `getGenerativeModel` with `ai.models.generateContent` and updated parameters.
export const getAnkaufOffer = async (prompt: string, image?: File): Promise<string> => {
    const systemInstruction = `You are an expert AI assistant for a second-hand electronics purchasing service. Your task is to analyze user descriptions and images of laptops and other electronics and provide a 3-tier purchase offer. You must follow these rules strictly:
1.  **Image is Mandatory for Offer:** If the user has not provided an image, politely ask them to upload one. Do not provide any price estimate without an image.
2.  **Laptop Offer Rules:**
    *   **Age Filter:** Gently decline to make an offer for laptops that are too old (e.g., models from 2017 or earlier, like an "HP ProBook 470 G5").
    *   **3-Tier Offer System:** For eligible laptops, you MUST present these three offers clearly:
        *   **Offer 1 (Instant Sale):** The base price. Calculate it using these exact rules:
            *   **Base Prices (for 17-inch models):**
                *   Perfect condition: 80€
                *   Scratches on the case: 60€
                *   Scratches on the screen: 20€
                *   Defective keyboard: 20€
                *   Liquid damage, mainboard defect, no display: 5€
            *   **Screen Size Rule:** If the laptop is smaller than 17 inches, SUBTRACT 30€ from the calculated base price.
            *   **Value-Add:** For new and valuable models (like a recent MacBook), you can ADD 20-30€ to the price.
        *   **Offer 2 (Sale within 2 Weeks):** Offer a higher price, specifically Base Price + 50€.
        *   **Offer 3 (Sale within 1 Month):** Offer the highest price, specifically Base Price + 70€.
    *   **Safety Net:** For Offers 2 and 3, you MUST include this guarantee: "If your product does not sell within the specified time, we guarantee to pay you the 'Instant Sale' price." Also, simulate that they can track the process with a user account.
3.  **Other Electronics (Smartphones, Game Consoles, etc.) Rules:**
    *   **Damage Rejection:** Do not make an offer for broken, damaged, or heavily scratched items. Instead, politely inform the user that they can sell their item for free on minianz.de.
    *   **Good Condition:** For items in good condition, determine a fair market 'Instant Sale' price. Then, present Offer 2 and Offer 3 as percentage-based increases on that price.
4.  **Language:** Respond in the same language as the user's prompt.
5.  **Format:** Use markdown for clear formatting, especially for the offers.`;

    const contentParts: any[] = [{ text: prompt }];
    if (image) {
        const imagePart = await fileToGenerativePart(image);
        contentParts.push(imagePart);
    }
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { role: 'user', parts: contentParts },
      config: {
        systemInstruction,
      },
    });
    // Fix: Changed `result.response.text()` to `response.text` as per API guidelines.
    return response.text;
};


// A.2 Single Listing Generator
// Fix: Replaced deprecated `getGenerativeModel` with `ai.models.generateContent` and updated parameters for JSON output.
export const generateSingleListing = async (productName: string, condition: string, notes: string, image?: File): Promise<{ title: string; description: string }> => {
    const prompt = `Generate an SEO-optimized, professional sales listing.
    Product Name: ${productName}
    Condition: ${condition}
    Notes: ${notes}
    
    Generate a JSON object with two keys: "title" and "description". The title should be catchy and include keywords. The description should be detailed, well-formatted with markdown (using bullet points for features), and persuasive.`;
    
    const parts: any[] = [{ text: prompt }];
    if (image) {
        const imagePart = await fileToGenerativePart(image);
        parts.push(imagePart);
    }
    
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
          },
          required: ["title", "description"],
        },
      }
    });
    // Fix: Changed `result.response.text()` to `result.text` as per API guidelines.
    const text = result.text;
    try {
      const sanitizedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(sanitizedText);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini:", text, e);
      return { title: "Error", description: "Failed to generate listing. Please try again." };
    }
};

// A.3 Bulk Listing Generator
// Fix: Replaced deprecated `getGenerativeModel` with `ai.models.generateContent` and updated parameters for JSON output.
export const generateBulkListings = async (csvData: { [key: string]: string }[]): Promise<any[]> => {
    const generatedListings = [];

    for (const row of csvData) {
        const prompt = `Generate a JSON object with "title" and "description" for a sales listing.
        Product Name: ${row.productName || ''}
        Condition: ${row.condition || ''}
        Price: ${row.price || ''}
        Notes: ${row.notes || ''}
        
        The title must be SEO-optimized. The description must be detailed and professional.`;

        try {
            const result = await ai.models.generateContent({
              model: "gemini-2.5-pro",
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                  required: ["title", "description"],
                }
              }
            });
            // Fix: Changed `result.response.text()` to `result.text` as per API guidelines.
            const text = result.text;
            const sanitizedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(sanitizedText);
            generatedListings.push({ ...row, ...parsed });
        } catch (e) {
            console.error("Error processing row:", row, e);
            generatedListings.push({ ...row, title: "Generation Error", description: "Could not generate listing for this item." });
        }
    }
    return generatedListings;
};


// Image Generation
export const generateImage = async (prompt: string, aspectRatio: string): Promise<string> => {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
        },
    });
    const base64ImageBytes = response.generatedImages[0].image.imageBytes;
    return `data:image/png;base64,${base64ImageBytes}`;
};

// Video Generation (Veo)
export const generateVideo = async (prompt: string, image: File | null, aspectRatio: string): Promise<string> => {
    let newAiInstance: GoogleGenAI | null = null;
    try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await window.aistudio.openSelectKey();
        }
        newAiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } catch(e) {
        await window.aistudio.openSelectKey();
        newAiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    
    const veoPayload: any = {
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    };

    if (image) {
        const base64EncodedDataPromise = new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(image);
        });
        const base64Data = await base64EncodedDataPromise;
        veoPayload.image = {
            imageBytes: base64Data,
            mimeType: image.type,
        };
    }

    let operation = await newAiInstance.models.generateVideos(veoPayload);

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await newAiInstance.operations.getVideosOperation({ operation: operation });
    }

    if (operation.error) {
        // Fix: Cast `operation.error` to `any` to safely access the `message` property and avoid a type error.
        const errorMessage = (operation.error as any)?.message || 'Unknown video generation error';
        if(errorMessage.includes("Requested entity was not found.")){
            await window.aistudio.openSelectKey();
            throw new Error("API key invalid. Please select a valid key and try again.");
        }
        throw new Error(errorMessage);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation failed to produce a download link.");
    }

    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
};


// Research with Grounding
// Fix: Replaced deprecated `getGenerativeModel` with `ai.models.generateContent` and updated parameters.
export const researchWithGrounding = async (prompt: string, useMaps: boolean): Promise<GenerateContentResponse> => {
    const tools = useMaps ? [{ googleMaps: {} }, {googleSearch: {}}] : [{ googleSearch: {} }];

    const toolConfigParams: any = {};
    if (useMaps) {
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            toolConfigParams.toolConfig = {
                retrievalConfig: {
                    latLng: {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    }
                }
            };
        } catch (error) {
            console.warn("Could not get geolocation. Maps grounding will be less accurate.");
        }
    }
    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools,
        },
        ...toolConfigParams
    });
    // Fix: `generateContent` returns the response directly, so `result.response` is incorrect.
    return result;
};


// General AI Chat Stream
// Fix: Replaced deprecated `getGenerativeModel` and `model.startChat` with `ai.chats.create`.
export const startChat = (): Chat => {
  return ai.chats.create({
    model: "gemini-2.5-flash",
  });
};

// Fix: Updated function signature and logic for chat streaming to align with the new API.
export const sendMessageStream = async (chat: Chat, message: string, image?: File): Promise<AsyncGenerator<GenerateContentResponse>> => {
    const parts: any[] = [{ text: message }];
    if (image) {
        const imagePart = await fileToGenerativePart(image);
        parts.push(imagePart);
    }
    // Fix: The `sendMessageStream` method expects an object with a `message` property containing an array of parts.
    const stream = await chat.sendMessageStream({ message: parts });
    return stream;
};

// Image Editing
// Fix: Replaced deprecated `getGenerativeModel` with `ai.models.generateContent` and updated parameters for image editing.
export const editImage = async (prompt: string, image: File): Promise<string> => {
    const imagePart = await fileToGenerativePart(image);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                imagePart as any,
                { text: prompt },
            ],
        },
        // Fix: Use `config` with `responseModalities` for image generation/editing models.
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    // Fix: Changed `response.response.candidates` to `response.candidates`.
    const firstPart = response.candidates?.[0]?.content?.parts?.[0];
    if (firstPart && 'inlineData' in firstPart && firstPart.inlineData) {
      return `data:image/png;base64,${firstPart.inlineData.data}`;
    }
    throw new Error("Image editing failed to produce an image.");
};