USE udyamsense;
INSERT INTO machines (machine_name, machine_code, location)
VALUES ('Prototype Machine', 'M001', 'Prototype site')
ON DUPLICATE KEY UPDATE machine_name = VALUES(machine_name), location = VALUES(location);
