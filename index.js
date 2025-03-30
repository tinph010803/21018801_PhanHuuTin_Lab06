const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid'); // Bước 6

dotenv.config();

const app = express();
const port = 3000;

// CloudFront URL
const CLOUD_FRONT_URL = 'https://d3mht49lk9gq5e.cloudfront.net/'; // Bước 8

// Middleware đọc form
app.use(express.urlencoded({ extended: true }));

// View engine
app.use(express.static('./views'));
app.set('view engine', 'ejs');
app.set('views', './views');

// Cấu hình AWS
const config = new AWS.Config({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
AWS.config = config;

const s3 = new AWS.S3();
const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = 'TinTable';

// Bước 7: Cấu hình multer upload
const storage = multer.memoryStorage();

function checkFileType(file, cb) {
  const fileTypes = /jpeg|jpg|png|gif/;
  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = fileTypes.test(file.mimetype);
  if (extname && mimetype) {
    return cb(null, true);
  }
  return cb("Error: Image Only");
}

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter(req, file, cb) {
    checkFileType(file, cb);
  },
});

// Route hiển thị danh sách
app.get('/', (req, res) => {
  const params = {
    TableName: tableName,
  };

  docClient.scan(params, (err, data) => {
    if (err) {
      console.error("LỖI LẤY DỮ LIỆU:", err);
      return res.send('Internal Server Error');
    }
    res.render('index', { sanPhams: data.Items });
  });
});

// Route thêm sản phẩm + upload S3 + tạo link CloudFront
app.post('/add', upload.single('image'), (req, res) => {
  const { ma_sp, ten_sp, so_luong } = req.body;
  let image_url = '';

  if (req.file) {
    const image = req.file.originalname.split(".");
    const fileType = image[image.length - 1];
    const filePath = `${uuidv4()}-${Date.now().toString()}.${fileType}`;

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filePath,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    s3.upload(params, (error, data) => {
      if (error) {
        console.log('error = ', error);
        return res.send('Internal Server Error');
      } else {
        const newItem = {
          TableName: tableName,
          Item: {
            "ma_sp": Number(ma_sp),
            "ten_sp": ten_sp,
            "so_luong": Number(so_luong),
            "image_url": `${CLOUD_FRONT_URL}${filePath}`
          }
        };

        docClient.put(newItem, (err, data) => {
          if (err) {
            console.log('error = ', err);
            return res.send('Internal Server Error');
          } else {
            return res.redirect("/");
          }
        });
      }
    });
  } else {
    const newItem = {
      TableName: tableName,
      Item: {
        "ma_sp": Number(ma_sp),
        "ten_sp": ten_sp,
        "so_luong": Number(so_luong),
        "image_url": ""
      }
    };

    docClient.put(newItem, (err, data) => {
      if (err) {
        console.log('error = ', err);
        return res.send('Internal Server Error');
      } else {
        return res.redirect("/");
      }
    });
  }
});

// Route xoá
app.post('/delete', upload.none(), (req, res) => {
  let { ma_sp } = req.body;

  if (!ma_sp) return res.redirect('/');
  if (!Array.isArray(ma_sp)) ma_sp = [ma_sp];

  function deleteNext(index) {
    if (index >= ma_sp.length) return res.redirect('/');

    const params = {
      TableName: tableName,
      Key: { ma_sp: Number(ma_sp[index]) },
    };

    docClient.delete(params, (err) => {
      if (err) {
        console.error("LỖI XOÁ:", err);
        return res.send('Xoá thất bại');
      }
      deleteNext(index + 1);
    });
  }

  deleteNext(0);
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});