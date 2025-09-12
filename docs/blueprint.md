# **App Name**: NutriAI Companion

## Core Features:

- User Profile: User authentication and profile setup (age, weight, height, gender, activity level, and goal - lose, maintain, gain weight).
- Calorie Target Calculation: Calculate daily caloric target using Mifflin-St Jeor formula and activity factor, dynamically updated based on user inputs.
- Meal Input via Chat: Simple and intuitive chat interface (webapp and WhatsApp) for users to input their meals using text descriptions.
- Meal Input via Image: Meal input via image.
- Barcode scanner: Allow food logging via barcode.
- Progress Chart: Visual representation of daily and weekly progress regarding calories, protein, carbs, and fat, including current consumption versus daily goal.
- Acessibilidade: Certifique-se que o design seja acessível (contraste, navegação via teclado, labels ARIA).
- Privacidade e Segurança: Reforce política de não armazenamento de imagens após análise. Use regras de segurança do Firestore e Storage.
- Exportação de Dados: Permita exportar histórico alimentar para PDF/CSV.
- Notificações: Adicione notificações (push/email) para lembrar refeições/metas, se desejar.
- Configuração do Tema: Considere modo claro/escuro (dark mode), caso queira adaptar para diferentes ambientes.

## Style Guidelines:

- Primary color: HSL 50, 70%, 50% which becomes #E0B319 - A warm gold, representing vitality and health.
- Background color: HSL 50, 20%, 95% which becomes #F7F4EF - A very light, desaturated yellow-gold to ensure readability.
- Accent color: HSL 20, 90%, 40% which becomes #CD4A0A - A vivid reddish-orange to highlight important action items.
- Body: 'PT Sans', a humanist sans-serif, offers a blend of modernity and approachability suitable for informational content. Headlines: 'Playfair', a modern serif is ideal for headlines and small amounts of text.
- Use clean, minimalist icons for food groups, progress tracking, and settings to provide intuitive navigation.
- Implement a clear, responsive layout optimized for both web and mobile interfaces, ensuring usability across devices.
- Use subtle transitions and animations for feedback and user guidance.