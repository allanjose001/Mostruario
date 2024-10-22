require('dotenv').config();
const express = require('express');
const multer = require('multer')
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const supaUrl = 'https://lzaeumawxdtfjxdvpmrv.supabase.co';
const chaveSupa = process.env.SUPABASE_KEY;

const supabase = createClient(supaUrl, chaveSupa);

//tratamento de dados da imagem
const upload = multer({ 
    dest: 'fotos/',
    limits: { fileSize: 5 * 1024 * 1024 }, //limite de 5mb
    fileFilter: (req, file, cb) => {
        console.log("tentando fazer upload de: ", file);
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Arquivo não é uma imagem'), false);
        }
    }
});

const app = express();

//função de salvar a imagem
app.post('/fotos', upload.single('imagem'), async (req, res) => {
    try {
        let imagemUrl = null;

        if (req.file) {
            const imagemPath = req.file.path;
            const imagemNome = path.basename(req.file.originalname);
            console.log(path.basename(req.file.originalname));
            
            const { data, error } = await supabase.storage
            .from('imagens')
            .upload(imagemNome, fs.createReadStream(imagemPath), {
                cacheControl: '3600',
                upsert: false,
                contentType: req.file.mimetype,
                duplex: 'half',
            });
            
            if (error) {
                console.error("Erro no upload: ", error);
                throw error;
            }
            
            imagemUrl = supabase.storage.from('imagens').getPublicUrl(imagemNome).data.publicUrl;
        } else {
            console.log("nenhum arquivo recebido pelo multer");
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

//listar tudo do mostruario: getAll
app.get('/itens', async (req, res) => {
    try {
        const { data: itens, error } = await supabase.from('itens').select('*');
        if (error) throw error;
        res.status(200).json(itens);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/itens/:id', async(req, res) => {
    const { id } = req.params;

    try {
        //da um get no item desejado
        const { data: item, error: getItemError } = await supabase
            .from('itens')
            .select('imagem_url')
            .eq('id', id)
            .single();
        if (getItemError) {
            throw getItemError;
        }
        
        if (!item) {
            return res.status(404).json({ message: 'Item não encontrado' });
        }

        //pega o nome da imagem a partir do url dela
        const imagemNome = item.imagem_url.split('/').pop();
        console.log('Nome da imagem a ser deletada: ', imagemNome);

        //finalmente, deleta a imagem do bucket
        const { error: deleteImageError } = await supabase.storage
            .from('imagens')
            .remove([imagemNome]);
        
        if (deleteImageError) {
            console.error("erro ao deletar imagem: ", deleteImageError);
            throw deleteImageError;
        }

        //por fim, deleta a tabela do banco de dados
        const { error: deleteItemError } = await supabase
            .from('itens')
            .delete()
            .eq('id', id);

        if (deleteItemError) {
            throw deleteItemError;
        }

        res.status(200).json({ message: 'Item deletado com sucesso' });
    
    } catch (err) {
        console.error('Erro ao deletar o item: ', err);
        res.status(500).json({ error: err.message });
    } 
});


app.use(express.json());

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log('server aberto no localhost:5000');
});