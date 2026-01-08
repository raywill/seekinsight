
DROP TABLE IF EXISTS "saas_subscriptions";
CREATE TABLE "saas_subscriptions" (
  "sub_id" integer NOT NULL,
  "customer_email" varchar(100) DEFAULT NULL,
  "plan" varchar(20) DEFAULT NULL,
  "status" varchar(20) DEFAULT NULL,
  "mrr" integer DEFAULT NULL,
  "start_date" date DEFAULT NULL,
  PRIMARY KEY ("sub_id")
);
COMMENT ON TABLE "saas_subscriptions" IS 'Subscription records table';
COMMENT ON COLUMN "saas_subscriptions"."sub_id" IS 'Unique subscription identifier';
COMMENT ON COLUMN "saas_subscriptions"."customer_email" IS 'Customer email address';
COMMENT ON COLUMN "saas_subscriptions"."plan" IS 'Subscription plan (e.g. Pro, Enterprise)';
COMMENT ON COLUMN "saas_subscriptions"."status" IS 'Current status (Active, Churned)';
COMMENT ON COLUMN "saas_subscriptions"."mrr" IS 'Monthly Recurring Revenue';
COMMENT ON COLUMN "saas_subscriptions"."start_date" IS 'Subscription start date';

INSERT INTO "saas_subscriptions" VALUES 
(1,'cust1@corp.com','Enterprise','Active',500,'2023-01-01'),
(2,'cust2@startup.io','Pro','Active',99,'2023-02-15'),
(3,'cust3@gmail.com','Basic','Churned',29,'2023-01-10'),
(4,'cust4@tech.net','Pro','Active',99,'2023-03-01'),
(5,'cust5@agency.com','Enterprise','Active',500,'2023-03-20');

DROP TABLE IF EXISTS "saas_active_users";
CREATE TABLE "saas_active_users" (
  "log_id" integer NOT NULL,
  "date" date DEFAULT NULL,
  "dau" integer DEFAULT NULL,
  "wau" integer DEFAULT NULL,
  PRIMARY KEY ("log_id")
);
COMMENT ON TABLE "saas_active_users" IS 'Active user metrics table';
COMMENT ON COLUMN "saas_active_users"."log_id" IS 'Unique log identifier';
COMMENT ON COLUMN "saas_active_users"."date" IS 'Date of the record';
COMMENT ON COLUMN "saas_active_users"."dau" IS 'Daily Active Users count';
COMMENT ON COLUMN "saas_active_users"."wau" IS 'Weekly Active Users count';

INSERT INTO "saas_active_users" VALUES 
(1,'2023-06-01',1200,5500),
(2,'2023-06-02',1250,5600),
(3,'2023-06-03',1100,5400),
(4,'2023-06-04',1050,5450),
(5,'2023-06-05',1300,5700);
