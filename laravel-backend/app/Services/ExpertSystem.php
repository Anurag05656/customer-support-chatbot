<?php

namespace App\Services;

class ExpertSystem
{
    private array $rules = [
        ['id' => 'R1', 'intent' => 'Order Tracking',  'keywords' => ['track','order','shipping','delivery','where is','status','package','shipment'], 'priority' => 'medium', 'category' => 'orders',     'action' => 'Request order ID and provide tracking assistance'],
        ['id' => 'R2', 'intent' => 'Refund Request',   'keywords' => ['refund','money back','return','cancel order','cancellation'],                   'priority' => 'high',   'category' => 'billing',    'action' => 'Verify order details and initiate refund process'],
        ['id' => 'R3', 'intent' => 'Account Issues',   'keywords' => ['account','login','password','sign in','locked out','reset','profile'],          'priority' => 'high',   'category' => 'account',    'action' => 'Verify identity and assist with account recovery'],
        ['id' => 'R4', 'intent' => 'Human Agent',      'keywords' => ['human','agent','real person','manager','supervisor','escalate','talk to someone'], 'priority' => 'urgent', 'category' => 'escalation', 'action' => 'Acknowledge request and offer escalation path'],
        ['id' => 'R5', 'intent' => 'Product Inquiry',  'keywords' => ['product','item','price','available','stock','size','color','specification'],     'priority' => 'low',    'category' => 'products',   'action' => 'Provide product information and recommendations'],
        ['id' => 'R6', 'intent' => 'Complaint',        'keywords' => ['complaint','unhappy','disappointed','terrible','angry','frustrated','unacceptable'], 'priority' => 'urgent', 'category' => 'complaints', 'action' => 'Acknowledge frustration, apologize, offer resolution'],
        ['id' => 'R7', 'intent' => 'Payment Issues',   'keywords' => ['payment','charged','billing','credit card','transaction','invoice','double charged'], 'priority' => 'high', 'category' => 'billing',    'action' => 'Verify transaction and resolve billing discrepancy'],
        ['id' => 'R8', 'intent' => 'General Greeting',  'keywords' => ['hello','hi','hey','good morning','good afternoon','help'],                      'priority' => 'low',    'category' => 'general',    'action' => 'Greet customer and offer assistance'],
    ];

    public function analyze(string $message): array
    {
        $msg = strtolower($message);
        $matches = [];

        foreach ($this->rules as $rule) {
            $matched = [];
            foreach ($rule['keywords'] as $kw) {
                if (str_contains($msg, strtolower($kw))) {
                    $matched[] = $kw;
                }
            }
            if (!empty($matched)) {
                $conf = min(round((count($matched) / count($rule['keywords'])) * 100 + 30), 98);
                $matches[] = [
                    'rule_id'    => $rule['id'],
                    'intent'     => $rule['intent'],
                    'confidence' => $conf,
                    'priority'   => $rule['priority'],
                    'category'   => $rule['category'],
                    'action'     => $rule['action'],
                    'keywords'   => $matched,
                ];
            }
        }

        usort($matches, fn($a, $b) => $b['confidence'] <=> $a['confidence']);
        $primary = $matches[0] ?? null;

        return [
            'intent'       => $primary['intent'] ?? 'General Query',
            'confidence'   => $primary['confidence'] ?? 50,
            'priority'     => $primary['priority'] ?? 'low',
            'category'     => $primary['category'] ?? 'general',
            'action'       => $primary['action'] ?? 'Provide general assistance',
            'rules_fired'  => array_map(fn($m) => $m['rule_id'] . ': ' . $m['intent'], $matches),
            'total_rules'  => count($this->rules),
            'rules_matched' => count($matches),
        ];
    }
}
