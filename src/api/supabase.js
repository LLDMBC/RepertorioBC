import { supabase } from '../api/supabase.js';

async function obtenerPdfSeguro(nombreArchivo) {
    // Le pedimos a Supabase una URL que expira en 60 segundos
    const { data, error } = await supabase.storage
        .from('partituras')
        .createSignedUrl(nombreArchivo, 60);

    if (error) {
        console.error("Error de seguridad al pedir el PDF:", error);
        return null;
    }

    // Esta URL larga y segura es la que le pasas a pdf.js o al Service Worker
    return data.signedUrl; 
}
