require('dotenv').config();
const express = require('express');
const multer = require('multer')
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const supaUrl = 'https://lzaeumawxdtfjxdvpmrv.supabase.co';
const chaveSupa = process.env.SUPABASE_KEY;

const supabase = createClient(supaUrl, chaveSupa);

const upload = multer({ dest: 'fotos/' });

const app = express();
app.use(express.json());

app.post('/fotos', upload.single('imagem'), async (req, res) => {
    try {
        let imagemUrl = null;
        
        //função de salvar a imagem
        if (req.file) {
            const imagemPath = req.file.path;
            const imagemNome = path.basename(req.file.originalname);

            const { data, error } = await supabase.storage
                .from('imagens')
                .upload(imagemNome, fs.createReadStream(imagemPath), {
                    cacheControl: '3600', upsert: false,
                });

            if (error) throw error;

            imagemUrl = supabase.storage.from('imagens').getPublicUrl(imagemNome).data.publicUrl;
        }
        //função de salvar a descrição no supabase

        const { nome, descricao, preco } = req.body;
        const { error: dbError } = await supabase
            .from('itens')
            .insert([{ nome, descricao, preco, imagem_url: imagemUrl }]);

        if (dbError) throw dbError;
        
        res.status(200).json({ message: 'item salvo com sucesso - backend', imagemUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//listar tudo do mostruario : getAll
app.get('/itens', async (req, res) => {
    try {
        const { data: itens, error } = await supabase.from('itens').select('*');
        if (error) throw error;
        res.status(200).json(itens);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log('server aberto no localhost:5000');
});