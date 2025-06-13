# Node Operators Questionnaire

Thank you for showing interest in becoming a nilDB Node Operator. This questionnaire helps us understand your operational and infrastructure compatibility. Please provide detailed responses and return to your Nillion point of contact.

## Builder Details

Please provide your company name (if applicable), primary contact name, role/title, contact email, phone number, and the timezone in which your team primarily operates.

## Infrastructure & Hosting

### Network Configuration & Security

A nilDB node requires a DNS record from a public zone and runs a RESTful API service that should be publicly accessible. The service expects TLS termination upstream on port 443, with internal traffic on port 8080 and metrics exposed on port 9091. Please describe your capabilities for managing DNS records, handling TLS termination (including certificate management and renewal), and implementing network security controls. Include any custom resolver settings or cache policies that might affect DNS record freshness.

### Compute Resources

A nilDB node is packaged as a Docker image supporting Linux/amd64 and aarch64 platforms. Please describe your container orchestration platform, scaling capabilities, and resource management approach. Include details about your infrastructure provider(s) and how you achieve geographic distribution of resources, as the nilDB network requires both host and geo-diversity.

### Data Storage

A nilDB node uses MongoDB version 8+ for data persistence. The database service must be resilient, utilizing clustering, undergo regular backups, and encrypt data at rest and in transit. Additionally, as use increases so to will data storage requirements and so operators storage facilities must scale. Please describe your MongoDB deployment, including its topology, backup strategy, encryption implementation, and how you monitor and scale the database to meet demand.

## Operations & Monitoring

### Observability

A nilDB node outputs logs to stdout/stderr and serves Prometheus metrics. Both logs and metrics must be retained for at least 30 days for offline inspection. Please describe your observability stack, including how you collect, store, and secure logs and metrics. If you use third-party services for this purpose, please include these details. Finally, describe your alert management system and how you monitor service health.

### Security Operations

#### Access Control & Asset Security

A nilDB node must operate in a confidential, tamper-proof environment with controlled access. Please describe how you manage workload isolation at various levels (container, VM, network), your identity management system, and authentication methods. Include details about your implementation of multifactor authentication, role-based access control, and your procedures for managing personnel access (joiners/movers/leavers).

#### Data Protection

Data security is crucial for nilDB operations. Please detail your encryption strategy for both data in transit and at rest, including key management procedures. Explain how you guarantee data confidentiality, integrity, and availability. Include any relevant compliance certifications or security standards you adhere to.

#### Incident Management & Availability

Node operators must maintain high availability and respond promptly to service-impacting or security incidents. Please describe your incident response process, including team availability, response time commitments, and escalation procedures. Explain how you ensure service resilience during both normal and adverse situations, and how you monitor for potential security events or unauthorized access attempts.

### Business Continuity

Service continuity is essential for nilDB operations. Please describe your disaster recovery plan, including backup procedures, fail over capabilities, and how you test these systems. Include your service level objectives and how you ensure they are met.

### Security Monitoring

Node operators must actively manage security risks. Please describe your vulnerability management approach, including how you detect and respond to security threats. Detail the tools and processes you use for security monitoring, compliance checking, and risk assessment.

## Additional Information

Please provide any other relevant information about your capabilities, including previous experience running similar services, planned infrastructure improvements, or additional security measures. You may also use this section to ask questions or raise concerns about the operational requirements.
