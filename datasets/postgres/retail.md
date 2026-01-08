
DROP TABLE IF EXISTS "retail_products";
CREATE TABLE "retail_products" (
  "product_id" integer NOT NULL,
  "category" varchar(50) DEFAULT NULL,
  "name" varchar(100) DEFAULT NULL,
  "price" decimal(10,2) DEFAULT NULL,
  PRIMARY KEY ("product_id")
);
COMMENT ON TABLE "retail_products" IS 'Product information table';
COMMENT ON COLUMN "retail_products"."product_id" IS 'Unique product identifier';
COMMENT ON COLUMN "retail_products"."category" IS 'Product category';
COMMENT ON COLUMN "retail_products"."name" IS 'Product name';
COMMENT ON COLUMN "retail_products"."price" IS 'Unit price';

INSERT INTO "retail_products" VALUES 
(101,'Electronics','Smartphone X',799.00),
(102,'Electronics','Noise Cancelling Headphones',299.00),
(103,'Home','Smart Coffee Maker',149.00),
(104,'Home','Robot Vacuum',499.00),
(105,'Fashion','Leather Jacket',199.00),
(106,'Fashion','Running Shoes',89.00);

DROP TABLE IF EXISTS "retail_customers";
CREATE TABLE "retail_customers" (
  "customer_id" integer NOT NULL,
  "name" varchar(100) DEFAULT NULL,
  "region" varchar(50) DEFAULT NULL,
  "signup_date" date DEFAULT NULL,
  PRIMARY KEY ("customer_id")
);
COMMENT ON TABLE "retail_customers" IS 'Customer details table';
COMMENT ON COLUMN "retail_customers"."customer_id" IS 'Unique customer identifier';
COMMENT ON COLUMN "retail_customers"."name" IS 'Customer full name';
COMMENT ON COLUMN "retail_customers"."region" IS 'Geographic region';
COMMENT ON COLUMN "retail_customers"."signup_date" IS 'Date of registration';

INSERT INTO "retail_customers" VALUES 
(1,'Alice Smith','North America','2023-01-15'),
(2,'Bob Johnson','Europe','2023-02-20'),
(3,'Charlie Lee','Asia','2023-03-10'),
(4,'Diana Prince','North America','2023-04-05');

DROP TABLE IF EXISTS "retail_orders";
CREATE TABLE "retail_orders" (
  "order_id" integer NOT NULL,
  "customer_id" integer DEFAULT NULL,
  "product_id" integer DEFAULT NULL,
  "order_date" date DEFAULT NULL,
  "quantity" integer DEFAULT NULL,
  "amount" decimal(10,2) DEFAULT NULL,
  PRIMARY KEY ("order_id")
);
COMMENT ON TABLE "retail_orders" IS 'Sales transaction table';
COMMENT ON COLUMN "retail_orders"."order_id" IS 'Unique order identifier';
COMMENT ON COLUMN "retail_orders"."customer_id" IS 'Associated Customer ID';
COMMENT ON COLUMN "retail_orders"."product_id" IS 'Associated Product ID';
COMMENT ON COLUMN "retail_orders"."order_date" IS 'Date the order was placed';
COMMENT ON COLUMN "retail_orders"."quantity" IS 'Quantity purchased';
COMMENT ON COLUMN "retail_orders"."amount" IS 'Total transaction amount';

INSERT INTO "retail_orders" VALUES 
(1001,1,101,'2023-05-01',1,799.00),
(1002,1,102,'2023-05-02',2,598.00),
(1003,2,103,'2023-05-05',1,149.00),
(1004,3,101,'2023-06-01',1,799.00),
(1005,4,106,'2023-06-10',2,178.00),
(1006,2,104,'2023-06-15',1,499.00),
(1007,3,105,'2023-07-01',1,199.00);
